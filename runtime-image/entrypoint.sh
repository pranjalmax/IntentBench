#!/bin/sh
set -eu

test -f /intentbench-auth/auth.json
test -d /workspace
test -d /intentbench-output

rm -rf /workspace/node_modules
cp -a /opt/intentbench-node_modules /workspace/node_modules

ln -s /intentbench-auth/auth.json /codex-home/auth.json

export CODEX_HOME=/codex-home
export HOME=/home/intentbench
export NO_COLOR=1

exec codex "$@"

