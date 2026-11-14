#!/usr/bin/env bash
# Measures whether `next build` fits in a small machine, by running it inside a container with a hard memory limit.
#   tools/build-memory.sh [memory limit, default 1800m]
# Needs the image from Dockerfile.memtest:   docker build --load -f Dockerfile.memtest -t tauplo-memtest .
# Prints, for each bundler, the exit code (137 means the kernel killed the build for lack of memory) and the peak memory seen.
set -u
LIMIT="${1:-1800m}"
for mode in turbopack webpack; do
  name="tauplo-build-$mode"
  flag=""; [ "$mode" = "webpack" ] && flag="--webpack"
  docker rm -f "$name" >/dev/null 2>&1
  docker run -d --name "$name" --memory="$LIMIT" --memory-swap="$LIMIT" \
    -e DATABASE_URL="postgresql://build:build@localhost:5432/build" -e NEXT_TELEMETRY_DISABLED=1 \
    tauplo-memtest sh -c "npx prisma generate >/dev/null 2>&1 && npx next build $flag" >/dev/null || { echo "$mode: container failed to start"; continue; }
  peak=0
  while [ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)" = "true" ]; do
    cur=$(docker stats --no-stream --format '{{.MemUsage}}' "$name" 2>/dev/null | awk '{print $1}')
    case "$cur" in
      *GiB) v=$(echo "${cur%GiB} * 1024" | bc | cut -d. -f1) ;;
      *MiB) v=$(echo "${cur%MiB}" | cut -d. -f1) ;;
      *) v=0 ;;
    esac
    [ "${v:-0}" -gt "$peak" ] && peak=$v
    sleep 1
  done
  code=$(docker inspect -f '{{.State.ExitCode}}' "$name")
  oom=$(docker inspect -f '{{.State.OOMKilled}}' "$name")
  echo "=== $mode: exit code $code, OOM-killed: $oom, peak memory seen: ${peak} MiB (limit $LIMIT)"
  docker logs "$name" 2>&1 | tail -4
  docker rm -f "$name" >/dev/null 2>&1
done
