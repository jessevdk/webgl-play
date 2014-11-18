#!/usr/bin/env python

import subprocess, re, os, sys

def parse_make():
    lines = subprocess.check_output(['make', '-n', '-p', '-i', '-k', '-r']).splitlines()

    target = re.compile('^([^\s:]+):\s*(.*)')

    targets = {}

    # First extract target: deps
    i = 0

    while i < len(lines):
        line = lines[i]
        i += 1

        if line == '# Not a target:':
            i += 1
            continue

        m = target.match(line)

        if m:
            targets[m.group(1)] = m.group(2).split(' ')

    return targets

targets = parse_make()
queue = set(['local-site', 'server-site'])

collected = set()

cwd = os.getcwd()

if not cwd.endswith('/'):
    cwd += '/'

while len(queue) > 0:
    item = queue.pop()

    if item.startswith(cwd):
        item = item[len(cwd):]

    if item in targets:
        for target in targets[item]:
            queue.add(target)
    elif os.path.exists(item):
        collected.add(item)

modified = set(subprocess.check_output(['git', 'diff', 'HEAD', '--cached', '--name-only']).splitlines())

if not bool(modified & collected):
    sys.exit(1)
