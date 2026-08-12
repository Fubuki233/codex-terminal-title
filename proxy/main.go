package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode"
	"unicode/utf8"
)

const envPrefix = "CODEX_TERMINAL_TITLE_"

type config struct {
	realCodex      string
	originalPath   string
	extraArgs      []string
	titlePrefix    string
	promptMaxWidth int
	ellipsis       string
	pollInterval   time.Duration
}

type thread struct {
	ID        string  `json:"id"`
	Preview   *string `json:"preview"`
	Name      *string `json:"name"`
	CreatedAt int64   `json:"createdAt"`
}

type rpcEnvelope struct {
	ID     int64           `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type appServerClient struct {
	process   *exec.Cmd
	stdin     io.WriteCloser
	responses chan rpcEnvelope
	nextID    atomic.Int64
	requestMu sync.Mutex
	closeOnce sync.Once
}

func main() {
	cfg := loadConfig()
	emitTitle(normalize(cfg.titlePrefix + "Codex"))

	realCodex, err := findRealCodex(cfg.realCodex, cfg.originalPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Codex Terminal Title: %v\n", err)
		os.Exit(127)
	}

	childEnv := cleanEnvironment(cfg.originalPath)
	cwd, _ := os.Getwd()
	startedAt := time.Now().Add(-2 * time.Second).Unix()

	var client *appServerClient
	baseline := map[string]struct{}{}
	if candidate, startErr := startAppServer(realCodex, childEnv); startErr == nil {
		client = candidate
		if threads, listErr := client.listThreads(cwd); listErr == nil {
			for _, item := range threads {
				baseline[item.ID] = struct{}{}
			}
		}
	}

	args := append(append([]string{}, cfg.extraArgs...), os.Args[1:]...)
	command := commandForExecutable(realCodex, args...)
	command.Env = childEnv
	command.Dir = cwd
	command.Stdin = os.Stdin
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr

	if err := command.Start(); err != nil {
		if client != nil {
			client.close()
		}
		fmt.Fprintf(os.Stderr, "Codex Terminal Title: unable to start Codex CLI: %v\n", err)
		os.Exit(1)
	}

	stop := make(chan struct{})
	go watchTitle(client, cfg, cwd, baseline, startedAt, stop)

	err = command.Wait()
	close(stop)
	if client != nil {
		client.close()
	}
	if err == nil {
		return
	}
	var exitError *exec.ExitError
	if errors.As(err, &exitError) {
		os.Exit(exitError.ExitCode())
	}
	fmt.Fprintf(os.Stderr, "Codex Terminal Title: Codex CLI failed: %v\n", err)
	os.Exit(1)
}

func loadConfig() config {
	maxWidth := integerEnvironment(envPrefix+"PROMPT_MAX_WIDTH", 32)
	pollMilliseconds := integerEnvironment(envPrefix+"POLL_INTERVAL_MS", 1000)
	if pollMilliseconds < 500 {
		pollMilliseconds = 500
	}
	var extraArgs []string
	_ = json.Unmarshal([]byte(os.Getenv(envPrefix+"EXTRA_ARGS")), &extraArgs)
	ellipsis := os.Getenv(envPrefix + "ELLIPSIS")
	if ellipsis == "" {
		ellipsis = "…"
	}
	prefix := os.Getenv(envPrefix + "TITLE_PREFIX")
	if prefix == "" {
		prefix = "Codex: "
	}
	originalPath := pathWithoutProxy(os.Getenv("PATH"))
	if originalPath == "" {
		originalPath = os.Getenv(envPrefix + "ORIGINAL_PATH")
	}
	return config{
		realCodex:      os.Getenv(envPrefix + "REAL_CODEX"),
		originalPath:   originalPath,
		extraArgs:      extraArgs,
		titlePrefix:    prefix,
		promptMaxWidth: maxWidth,
		ellipsis:       ellipsis,
		pollInterval:   time.Duration(pollMilliseconds) * time.Millisecond,
	}
}

func pathWithoutProxy(currentPath string) string {
	executable, err := os.Executable()
	if err != nil {
		return currentPath
	}
	proxyDirectory := filepath.Clean(filepath.Dir(executable))
	directories := filepath.SplitList(currentPath)
	filtered := make([]string, 0, len(directories))
	for _, directory := range directories {
		cleaned := filepath.Clean(directory)
		equal := cleaned == proxyDirectory
		if runtime.GOOS == "windows" {
			equal = strings.EqualFold(cleaned, proxyDirectory)
		}
		if !equal {
			filtered = append(filtered, directory)
		}
	}
	return strings.Join(filtered, string(os.PathListSeparator))
}

func watchTitle(
	client *appServerClient,
	cfg config,
	cwd string,
	baseline map[string]struct{},
	startedAt int64,
	stop <-chan struct{},
) {
	ticker := time.NewTicker(cfg.pollInterval)
	defer ticker.Stop()
	threadID := ""
	currentTitle := normalize(cfg.titlePrefix + "Codex")

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if client != nil {
				threads, err := client.listThreads(cwd)
				if err != nil {
					emitTitle(currentTitle)
					continue
				}
				if threadID == "" {
					threadID = selectNewThread(threads, baseline, startedAt)
				}
				if threadID != "" {
					for _, item := range threads {
						if item.ID == threadID {
							currentTitle = displayTitle(cfg, item)
							break
						}
					}
				}
			}
			emitTitle(currentTitle)
		}
	}
}

func displayTitle(cfg config, item thread) string {
	if item.Name != nil {
		if title := normalize(*item.Name); title != "" {
			return normalize(cfg.titlePrefix + title)
		}
	}
	if item.Preview != nil {
		if preview := truncateDisplayWidth(*item.Preview, cfg.promptMaxWidth, cfg.ellipsis); preview != "" {
			return normalize(cfg.titlePrefix + preview)
		}
	}
	return normalize(cfg.titlePrefix + "Codex")
}

func selectNewThread(threads []thread, baseline map[string]struct{}, startedAt int64) string {
	candidates := make([]thread, 0)
	for _, item := range threads {
		if _, existed := baseline[item.ID]; existed {
			continue
		}
		if item.CreatedAt != 0 && item.CreatedAt < startedAt {
			continue
		}
		candidates = append(candidates, item)
	}
	sort.SliceStable(candidates, func(left, right int) bool {
		return candidates[left].CreatedAt < candidates[right].CreatedAt
	})
	if len(candidates) == 0 {
		return ""
	}
	return candidates[0].ID
}

func startAppServer(realCodex string, environment []string) (*appServerClient, error) {
	command := commandForExecutable(realCodex, "app-server", "--listen", "stdio://")
	command.Env = environment
	stdin, err := command.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return nil, err
	}
	command.Stderr = io.Discard
	if err := command.Start(); err != nil {
		_ = stdin.Close()
		return nil, err
	}

	client := &appServerClient{
		process:   command,
		stdin:     stdin,
		responses: make(chan rpcEnvelope, 16),
	}
	go client.readResponses(stdout)

	var ignored json.RawMessage
	if err := client.request("initialize", map[string]any{
		"clientInfo": map[string]string{
			"name":    "codex_terminal_title",
			"title":   "Codex Terminal Title",
			"version": "0.2.3",
		},
	}, &ignored); err != nil {
		client.close()
		return nil, err
	}
	if err := client.notify("initialized", map[string]any{}); err != nil {
		client.close()
		return nil, err
	}
	return client, nil
}

func (client *appServerClient) listThreads(cwd string) ([]thread, error) {
	var result struct {
		Data []thread `json:"data"`
	}
	err := client.request("thread/list", map[string]any{
		"cursor":        nil,
		"limit":         100,
		"sortKey":       "created_at",
		"sortDirection": "desc",
		"sourceKinds":   []string{"cli"},
		"cwd":           cwd,
	}, &result)
	return result.Data, err
}

func (client *appServerClient) request(method string, params any, result any) error {
	client.requestMu.Lock()
	defer client.requestMu.Unlock()
	id := client.nextID.Add(1)
	payload, err := json.Marshal(map[string]any{"method": method, "id": id, "params": params})
	if err != nil {
		return err
	}
	if _, err := client.stdin.Write(append(payload, '\n')); err != nil {
		return err
	}
	timer := time.NewTimer(4 * time.Second)
	defer timer.Stop()
	for {
		select {
		case response, ok := <-client.responses:
			if !ok {
				return errors.New("Codex app-server closed")
			}
			if response.ID != id {
				continue
			}
			if response.Error != nil {
				return fmt.Errorf("Codex app-server error %d: %s", response.Error.Code, response.Error.Message)
			}
			if len(response.Result) == 0 || result == nil {
				return nil
			}
			return json.Unmarshal(response.Result, result)
		case <-timer.C:
			return fmt.Errorf("Codex app-server request timed out: %s", method)
		}
	}
}

func (client *appServerClient) notify(method string, params any) error {
	payload, err := json.Marshal(map[string]any{"method": method, "params": params})
	if err != nil {
		return err
	}
	_, err = client.stdin.Write(append(payload, '\n'))
	return err
}

func (client *appServerClient) readResponses(reader io.Reader) {
	defer close(client.responses)
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		var envelope rpcEnvelope
		if json.Unmarshal(scanner.Bytes(), &envelope) == nil && envelope.ID != 0 {
			client.responses <- envelope
		}
	}
}

func (client *appServerClient) close() {
	client.closeOnce.Do(func() {
		_ = client.stdin.Close()
		if client.process.Process != nil {
			_ = client.process.Process.Kill()
		}
		_ = client.process.Wait()
	})
}

func emitTitle(title string) {
	if title == "" {
		title = "Codex"
	}
	fmt.Fprintf(os.Stdout, "\x1b]2;%s\x07", title)
}

func normalize(value string) string {
	var output strings.Builder
	spacePending := false
	for _, item := range strings.TrimSpace(value) {
		if unicode.IsControl(item) || unicode.IsSpace(item) {
			spacePending = output.Len() > 0
			continue
		}
		if spacePending {
			output.WriteByte(' ')
			spacePending = false
		}
		output.WriteRune(item)
	}
	return output.String()
}

func truncateDisplayWidth(value string, maxWidth int, ellipsis string) string {
	normalized := normalize(value)
	if normalized == "" || maxWidth <= 0 {
		return ""
	}
	clusters := graphemeClusters(normalized)
	fullWidth := 0
	for _, cluster := range clusters {
		fullWidth += clusterWidth(cluster)
	}
	if fullWidth <= maxWidth {
		return normalized
	}
	ellipsis = normalize(ellipsis)
	ellipsisWidth := 0
	for _, cluster := range graphemeClusters(ellipsis) {
		ellipsisWidth += clusterWidth(cluster)
	}
	if ellipsisWidth > maxWidth {
		ellipsis = ""
		ellipsisWidth = 0
	}
	limit := maxWidth - ellipsisWidth
	used := 0
	var output strings.Builder
	for _, cluster := range clusters {
		width := clusterWidth(cluster)
		if used+width > limit {
			break
		}
		output.WriteString(cluster)
		used += width
	}
	output.WriteString(ellipsis)
	return output.String()
}

func graphemeClusters(value string) []string {
	var clusters []string
	var current bytes.Buffer
	joinNext := false
	for _, item := range value {
		combining := unicode.Is(unicode.Mn, item) || unicode.Is(unicode.Me, item) || item == 0xfe0f
		if current.Len() > 0 && !combining && !joinNext && item != 0x200d {
			clusters = append(clusters, current.String())
			current.Reset()
		}
		current.WriteRune(item)
		joinNext = item == 0x200d
	}
	if current.Len() > 0 {
		clusters = append(clusters, current.String())
	}
	return clusters
}

func clusterWidth(cluster string) int {
	wide := false
	for _, item := range cluster {
		if isWide(item) || isEmoji(item) {
			wide = true
		}
	}
	if wide {
		return 2
	}
	if utf8.RuneCountInString(cluster) == 0 {
		return 0
	}
	return 1
}

func isEmoji(item rune) bool {
	return (item >= 0x1f000 && item <= 0x1faff) || (item >= 0x2600 && item <= 0x27bf)
}

func isWide(item rune) bool {
	return item >= 0x1100 && (item <= 0x115f || item == 0x2329 || item == 0x232a ||
		(item >= 0x2e80 && item <= 0xa4cf && item != 0x303f) ||
		(item >= 0xac00 && item <= 0xd7a3) || (item >= 0xf900 && item <= 0xfaff) ||
		(item >= 0xfe10 && item <= 0xfe19) || (item >= 0xfe30 && item <= 0xfe6f) ||
		(item >= 0xff00 && item <= 0xff60) || (item >= 0xffe0 && item <= 0xffe6) ||
		(item >= 0x20000 && item <= 0x3fffd))
}

func findRealCodex(configured string, originalPath string) (string, error) {
	if configured == "" {
		configured = "codex"
	}
	if filepath.IsAbs(configured) || strings.ContainsAny(configured, `/\\`) {
		if info, err := os.Stat(configured); err == nil && !info.IsDir() {
			return configured, nil
		}
		return "", fmt.Errorf("configured Codex CLI was not found: %s", configured)
	}
	extensions := []string{""}
	if runtime.GOOS == "windows" {
		extensions = filepath.SplitList(strings.ReplaceAll(environmentValue("PATHEXT", ".COM;.EXE;.BAT;.CMD"), ";", string(os.PathListSeparator)))
	}
	for _, directory := range filepath.SplitList(originalPath) {
		for _, extension := range extensions {
			candidate := filepath.Join(directory, configured+strings.ToLower(extension))
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				return candidate, nil
			}
		}
	}
	return "", fmt.Errorf("unable to locate the real Codex CLI in the original PATH")
}

func cleanEnvironment(originalPath string) []string {
	result := make([]string, 0, len(os.Environ()))
	for _, item := range os.Environ() {
		name, _, found := strings.Cut(item, "=")
		if !found || strings.HasPrefix(strings.ToUpper(name), envPrefix) || strings.EqualFold(name, "PATH") {
			continue
		}
		result = append(result, item)
	}
	return append(result, "PATH="+originalPath)
}

func commandForExecutable(executable string, args ...string) *exec.Cmd {
	if runtime.GOOS != "windows" || (!strings.HasSuffix(strings.ToLower(executable), ".cmd") && !strings.HasSuffix(strings.ToLower(executable), ".bat")) {
		return exec.Command(executable, args...)
	}
	commandLine := quoteCmd(executable)
	for _, argument := range args {
		commandLine += " " + quoteCmd(argument)
	}
	return exec.Command(environmentValue("COMSPEC", "cmd.exe"), "/d", "/s", "/c", commandLine)
}

func quoteCmd(value string) string {
	if value != "" && !strings.ContainsAny(value, " \t&()[]{}^=;!'+,`~\"") {
		return value
	}
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

func integerEnvironment(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil {
		return fallback
	}
	return value
}

func environmentValue(name string, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
