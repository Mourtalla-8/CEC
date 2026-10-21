#!/usr/bin/env bash
# dépose d'une 1re demande (majeur) pour un usager handicap.
# usage : bash scripts/upload-pieces.sh [email] <motDePasse>   (ou MOT_DE_PASSE=... en variable)
set -euo pipefail
BASE=${BASE_URL:-http://localhost:5000}
EMAIL=${1:-test@test.com}
MDP=${2:-${MOT_DE_PASSE:?mot de passe requis (2e argument ou MOT_DE_PASSE)}}

# 1. connexion : récupère le token JWT
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"motDePasse\":\"$MDP\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

# 2. PDF factice, réutilisé pour chaque pièce
FICHIER=$(mktemp --suffix=.pdf)
printf '%%PDF-1.4\n%%%%EOF\n' > "$FICHIER"

# 3. un upload par type de document (201 attendu ; une pièce déjà présente est remplacée par une nouvelle version)
for TYPE in photo_identite_1 photo_identite_2 cni_recto cni_verso \
            certificat_residence certificat_invalidite justificatif_domicile demande_manuscrite extrait_naissance; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/upload/document" \
    -H "Authorization: Bearer $TOKEN" \
    -F "typeDocument=$TYPE" \
    -F "file=@$FICHIER;type=application/pdf")
  echo "$TYPE -> $CODE"
done

rm -f "$FICHIER"