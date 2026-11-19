#!/usr/bin/env bash
set -euo pipefail
command -v docker >/dev/null
if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  echo "KVM absent ou inaccessible. Utilisez un worker dédié avec virtualisation matérielle/nichée activée."
  exit 1
fi
docker pull "${ANDROID_IMAGE:-budtmo/docker-android:emulator_14.0}"
echo "Image Android téléchargée. Configurez les secrets et lancez node server/android/server.cjs."
