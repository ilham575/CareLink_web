#!/bin/bash
# Script to replace all hardcoded localhost URLs with API config

# สำหรับ Windows PowerShell:
# powershell -ExecutionPolicy Bypass -File "replace-urls.ps1"

# หรือ สำหรับ Linux/Mac:
# bash replace-urls.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Count changes
TOTAL=0

echo -e "${GREEN}=== Replacing hardcoded URLs with API config ===${NC}\n"

# Function to replace in files
replace_in_file() {
  local file=$1
  local old=$2
  local new=$3
  
  if grep -q "$old" "$file" 2>/dev/null; then
    sed -i "s|$old|$new|g" "$file"
    echo -e "${GREEN}✓${NC} Updated: $file"
    ((TOTAL++))
  fi
}

# ===== List of replacements =====
# Format: file_pattern | old_url | new_api_call

echo -e "${YELLOW}Updating sign-in page...${NC}"
sed -i "s|'http://localhost:1337/api/auth/local'|API.auth.login|g" src/js/pages/default/signin.js
sed -i "s|\`http://localhost:1337/api/users/\${userId}?populate=role\`|API.users.getById(userId)|g" src/js/pages/default/signin.js

echo -e "${YELLOW}Updating drug store pages...${NC}"
sed -i "s|'http://localhost:1337/api/drug-stores|API.drugStores.list|g" src/js/pages/default/DrugStoreDetail.js
sed -i "s|'http://localhost:1337/api/pharmacy-profiles|API.pharmacyProfiles.list|g" src/js/pages/default/DrugStoreDetail.js

echo -e "${YELLOW}Updating home pages...${NC}"
sed -i "s|'http://localhost:1337/api/drug-stores|API.drugStores.list|g" src/js/pages/default/home.js
sed -i "s|'http://localhost:1337/api/pharmacy-profiles|API.pharmacyProfiles.list|g" src/js/pages/default/home.js

echo -e "${YELLOW}Updating drug list...${NC}"
sed -i "s|'http://localhost:1337/api/drugs|API.drugs.list|g" src/js/pages/pharmacy/DrugList.js
sed -i "s|'http://localhost:1337/api/drug-batches|API.drugBatches|g" src/js/pages/pharmacy/DrugList.js

echo -e "${YELLOW}Updating customer pages...${NC}"
sed -i "s|'http://localhost:1337/api/customer-profiles|API.customerProfiles|g" src/js/pages/pharmacy/detail_customer.js
sed -i "s|'http://localhost:1337/api/staff-profiles|API.staffProfiles|g" src/js/pages/pharmacy/detail_customer.js
sed -i "s|'http://localhost:1337/api/notifications|API.notifications|g" src/js/pages/pharmacy/detail_customer.js

echo -e "${YELLOW}Updating admin pages...${NC}"
sed -i "s|'http://localhost:1337/api/pharmacy-profiles|API.pharmacyProfiles|g" src/js/pages/admin/AddPharmacy_admin.js
sed -i "s|'http://localhost:1337/api/drug-stores|API.drugStores|g" src/js/pages/admin/AddPharmacy_admin.js
sed -i "s|'http://localhost:1337/api/auth/local|API.auth.login|g" src/js/pages/admin/AddPharmacy_admin.js

echo -e "\n${GREEN}=== Replacement complete ===${NC}"
echo -e "${YELLOW}Total files updated: $TOTAL${NC}\n"
echo -e "${RED}⚠️  MANUAL TASKS REQUIRED:${NC}"
echo "1. Add import statements to each file:"
echo "   import { API, fetchWithAuth } from '../../../utils/apiConfig';"
echo ""
echo "2. Replace fetch() calls with proper API endpoint usage"
echo "3. Test each page to verify URLs work correctly"
echo ""
echo -e "${GREEN}✓ Use API config from utils/apiConfig.js${NC}"
