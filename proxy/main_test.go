package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalize(t *testing.T) {
	if actual := normalize("  fix\n\tthe\x00 bug  "); actual != "fix the bug" {
		t.Fatalf("unexpected normalized title: %q", actual)
	}
}

func TestTruncateChineseByDisplayWidth(t *testing.T) {
	if actual := truncateDisplayWidth("修复用户登录问题", 9, "…"); actual != "修复用户…" {
		t.Fatalf("unexpected truncated title: %q", actual)
	}
}

func TestKeepEmojiClusterIntact(t *testing.T) {
	if actual := truncateDisplayWidth("Fix 👨‍💻 login flow", 9, "…"); actual != "Fix 👨‍💻 l…" {
		t.Fatalf("unexpected emoji title: %q", actual)
	}
}

func TestGeneratedNameWins(t *testing.T) {
	name := "Fix OAuth login"
	preview := "a much longer initial prompt"
	actual := displayTitle(config{titlePrefix: "Codex: ", promptMaxWidth: 12, ellipsis: "…"}, thread{
		Name:    &name,
		Preview: &preview,
	})
	if actual != "Codex: Fix OAuth login" {
		t.Fatalf("unexpected generated title: %q", actual)
	}
}

func TestSelectNewThread(t *testing.T) {
	threads := []thread{{ID: "second", CreatedAt: 202}, {ID: "old", CreatedAt: 100}, {ID: "first", CreatedAt: 201}}
	baseline := map[string]struct{}{"old": {}}
	if actual := selectNewThread(threads, baseline, 200); actual != "first" {
		t.Fatalf("unexpected selected thread: %q", actual)
	}
}

func TestPathWithoutProxyKeepsShellAddedPaths(t *testing.T) {
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	proxyDirectory := filepath.Dir(executable)
	shellDirectory := filepath.Join(filepath.Dir(proxyDirectory), "shell-added-bin")
	current := strings.Join([]string{proxyDirectory, shellDirectory}, string(os.PathListSeparator))
	actual := pathWithoutProxy(current)
	if actual != shellDirectory {
		t.Fatalf("unexpected filtered PATH: %q", actual)
	}
}

func TestManagedCodexArgumentsDisableBuiltInTerminalTitle(t *testing.T) {
	actual := managedCodexArguments([]string{"--model", "gpt-test"}, []string{"resume", "thread-id"})
	expected := []string{"--config", "tui.terminal_title=[]", "--model", "gpt-test", "resume", "thread-id"}
	if strings.Join(actual, "\x00") != strings.Join(expected, "\x00") {
		t.Fatalf("unexpected managed arguments: %#v", actual)
	}
}
