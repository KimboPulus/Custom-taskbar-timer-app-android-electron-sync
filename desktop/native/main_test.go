package main

import "testing"

func TestRunRejectsInvalidArguments(t *testing.T) {
	tests := []struct {
		name string
		args []string
	}{
		{name: "missing command", args: []string{"helper"}},
		{name: "invalid handle", args: []string{"helper", "detach", "invalid"}},
		{name: "unknown command", args: []string{"helper", "unknown", "1"}},
		{name: "shortcut arguments", args: []string{"helper", "allow-shortcut", "extra"}},
		{name: "monitor arguments", args: []string{"helper", "monitor-right-alt", "extra"}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := run(test.args); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}

func TestParseInt32(t *testing.T) {
	tests := []struct {
		value string
		want  int32
		ok    bool
	}{
		{value: "0", want: 0, ok: true},
		{value: "-25", want: -25, ok: true},
		{value: "2147483647", want: 2147483647, ok: true},
		{value: "2147483648", ok: false},
		{value: "1.5", ok: false},
	}

	for _, test := range tests {
		got, err := parseInt32(test.value)
		if test.ok && (err != nil || got != test.want) {
			t.Fatalf("parseInt32(%q) = %d, %v; want %d", test.value, got, err, test.want)
		}
		if !test.ok && err == nil {
			t.Fatalf("parseInt32(%q) unexpectedly succeeded", test.value)
		}
	}
}
