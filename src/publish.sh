#!/usr/bin/env sh

# abort on errors
set -e

cd src

npm install
./deploy.sh
