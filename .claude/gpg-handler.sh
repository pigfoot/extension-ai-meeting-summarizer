#!/bin/bash

# Read JSON input from stdin
input_data=$(cat)

echo "🔧 GPG Handler: Hook triggered" >&2
echo "🔧 Input data: $input_data" >&2

# Parse JSON to get tool name and command
tool_name=$(echo "$input_data" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('tool_name', ''))" 2>/dev/null || echo "")
command=$(echo "$input_data" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('tool_input', {}).get('command', ''))" 2>/dev/null || echo "")

echo "🔧 Tool: $tool_name, Command: $command" >&2

# Only process Bash tool calls with git commit commands
if [ "$tool_name" != "Bash" ]; then
    echo "🔧 Not a Bash command, allowing" >&2
    exit 0
fi

if ! echo "$command" | grep -q "commit"; then
    echo "🔧 Not a commit command, allowing" >&2
    exit 0
fi

echo "🔧 GPG Handler: Git commit command detected" >&2

# Check if signing is needed
if git config --local --get commit.gpgsign 2>/dev/null | grep -q "true" || echo "$command" | grep -qE "\-S|--gpg-sign"; then
    echo "🔐 GPG signing required" >&2
    
    # Check cached passphrase
    if [ -f .claude/gpg-session ] && [ -n "$(cat .claude/gpg-session 2>/dev/null)" ]; then
        export GPG_PASSPHRASE="$(cat .claude/gpg-session)"
        export GPG_TTY=$(tty)
        echo "✅ Using cached GPG passphrase" >&2
    else
        # Ask for passphrase
        echo "🔑 Enter GPG passphrase:" >&2
        read -s -p "🔑 GPG passphrase: " gpg_pass
        echo "" >&2
        
        # Verify and cache
        if echo "test" | GPG_TTY=$(tty) gpg --pinentry-mode loopback --batch --passphrase "$gpg_pass" --clearsign >/dev/null 2>&1; then
            echo "$gpg_pass" > .claude/gpg-session
            chmod 600 .claude/gpg-session
            export GPG_PASSPHRASE="$gpg_pass"
            echo "✅ GPG environment ready" >&2
        else
            echo "❌ Invalid passphrase" >&2
            exit 2  # Block the command
        fi
    fi
    
    # Set GPG environment for the actual command
    export GPG_TTY=$(tty)
    echo "✅ GPG environment configured" >&2
fi

# Allow the command to proceed
exit 0
