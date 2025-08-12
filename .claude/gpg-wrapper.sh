#!/bin/bash
exec gpg --batch --pinentry-mode loopback --passphrase "${GPG_PASSPHRASE}" "$@"