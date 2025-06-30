#!/bin/bash

# Agent Rules Installation Script
# This script downloads all rule files from the agent-rules repository
# and places them in the .cursor/rules directory of the current project.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Repository information
REPO_URL="https://raw.githubusercontent.com/grdsdev/agent-rules/main"
RULES_DIR=".cursor/rules"

echo -e "${GREEN}Installing Agent Rules...${NC}"

# Create .cursor/rules directory if it doesn't exist
if [ ! -d "$RULES_DIR" ]; then
    echo -e "${YELLOW}Creating $RULES_DIR directory...${NC}"
    mkdir -p "$RULES_DIR"
fi

# Get list of all available rules from the repository
echo -e "${YELLOW}Fetching available rules...${NC}"

# Use GitHub API to get the list of files in the rules directory
RULES_JSON=$(curl -s "https://api.github.com/repos/grdsdev/agent-rules/contents/rules" | grep -o '"path":"[^"]*\.mdc"' | sed 's/"path":"//g' | sed 's/"//g')

if [ -z "$RULES_JSON" ]; then
    echo -e "${RED}✗ Failed to fetch rules list from repository${NC}"
    exit 1
fi

# Download each rule file
echo "$RULES_JSON" | while read -r rule; do
    if [ -n "$rule" ]; then
        filename=$(basename "$rule")
        echo -e "${YELLOW}Downloading $filename...${NC}"
        
        if curl -s -f "$REPO_URL/$rule" -o "$RULES_DIR/$filename"; then
            echo -e "${GREEN}✓ Downloaded $filename${NC}"
        else
            echo -e "${RED}✗ Failed to download $filename${NC}"
            exit 1
        fi
    fi
done

echo -e "${GREEN}✓ Agent Rules installation completed successfully!${NC}"
echo -e "${YELLOW}Rules are now available in $RULES_DIR/${NC}" 