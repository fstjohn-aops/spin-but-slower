#!/bin/bash

# Script to clear the instances cache
# This should only be run by server administrators

rm -f instances.json
rm -rf logs/*
echo "{}" > instances.json

exit 0