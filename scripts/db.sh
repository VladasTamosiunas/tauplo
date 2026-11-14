#!/usr/bin/env bash
# Project-local PostgreSQL for development and tests.
# Usage: bash scripts/db.sh start|stop|reset|status
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$ROOT/.pgdata"
PORT=54329
PGBIN="$(dirname "$(command -v pg_ctl)")"

init() {
  if [ ! -d "$DATA" ]; then
    "$PGBIN/initdb" -D "$DATA" -U tauplo --auth=trust --encoding=UTF8 >/dev/null
    echo "unix_socket_directories = '/tmp'" >> "$DATA/postgresql.conf"
  fi
}

start() {
  init
  if ! "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
    "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT" -l "$DATA/server.log" -w start >/dev/null
  fi
  for db in tauplo tauplo_test; do
    if ! "$PGBIN/psql" -h localhost -p $PORT -U tauplo -d postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1; then
      "$PGBIN/createdb" -h localhost -p $PORT -U tauplo "$db"
    fi
  done
  echo "Postgres is running on localhost:$PORT (databases: tauplo, tauplo_test)"
}

stop() {
  if [ -d "$DATA" ]; then "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; fi
  echo "Postgres stopped"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  reset) stop; rm -rf "$DATA"; start ;;
  status) "$PGBIN/pg_ctl" -D "$DATA" status ;;
  *) echo "usage: db.sh start|stop|reset|status"; exit 1 ;;
esac
