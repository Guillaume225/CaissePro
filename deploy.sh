#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# CaisseFlow Pro — Initial Deployment Script
# ═══════════════════════════════════════════════════════════
#
# Usage:
#   ./deploy.sh <environment>
#
# Examples:
#   ./deploy.sh staging
#   ./deploy.sh production
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - Docker / container runtime
#   - Helm (for cert-manager & nginx-ingress)
#   - Access to GitHub Container Registry
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Validate args ────────────────────────────────────────
ENV="${1:-}"
if [[ -z "$ENV" ]] || [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  err "Usage: $0 <staging|production>"
  exit 1
fi

NAMESPACE="caisseflow-${ENV/production/prod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="${SCRIPT_DIR}/infra/k8s"
MON_DIR="${SCRIPT_DIR}/infra/monitoring"

log "Deploying CaisseFlow Pro to ${ENV} (namespace: ${NAMESPACE})"
echo ""

# ── Step 1: Preflight checks ────────────────────────────
log "Step 1/8: Preflight checks..."

command -v kubectl >/dev/null 2>&1 || { err "kubectl not found"; exit 1; }
command -v helm >/dev/null 2>&1    || { err "helm not found"; exit 1; }
command -v docker >/dev/null 2>&1  || { warn "docker not found — skipping image builds"; }

kubectl cluster-info >/dev/null 2>&1 || { err "Cannot connect to Kubernetes cluster"; exit 1; }
ok "Cluster reachable"

# ── Step 2: Create namespaces ────────────────────────────
log "Step 2/8: Creating namespaces..."

kubectl apply -f "${K8S_DIR}/namespace.yaml"
ok "Namespaces created"

# ── Step 3: Install prerequisites ────────────────────────
log "Step 3/8: Installing prerequisites (cert-manager, ingress-nginx)..."

# cert-manager
if ! kubectl get namespace cert-manager >/dev/null 2>&1; then
  helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
  helm repo update
  helm install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --set installCRDs=true \
    --wait
  ok "cert-manager installed"
else
  ok "cert-manager already present"
fi

# nginx-ingress
if ! kubectl get namespace ingress-nginx >/dev/null 2>&1; then
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
  helm repo update
  helm install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    --wait
  ok "ingress-nginx installed"
else
  ok "ingress-nginx already present"
fi

# ── Step 4: Apply secrets & configmaps ───────────────────
log "Step 4/8: Applying ConfigMaps & Secrets..."

kubectl apply -f "${K8S_DIR}/configmaps.yaml" -n "${NAMESPACE}"
ok "ConfigMaps applied"

if [[ -f "${K8S_DIR}/secrets.yaml" ]]; then
  warn "Applying secrets template — ensure real values are set!"
  kubectl apply -f "${K8S_DIR}/secrets.yaml" -n "${NAMESPACE}"
  ok "Secrets applied (update with real values!)"
else
  warn "No secrets.yaml found — create secrets manually"
fi

# ── Step 5: Apply PersistentVolumeClaims ─────────────────
log "Step 5/8: Creating PersistentVolumeClaims..."

kubectl apply -f "${K8S_DIR}/pvc.yaml" -n "${NAMESPACE}"
ok "PVCs created"

# Wait for PVCs to be bound
log "Waiting for PVCs to bind..."
for PVC in mssql-data-pvc minio-pvc redis-pvc rabbitmq-pvc ml-models-pvc prometheus-pvc grafana-pvc; do
  kubectl wait --for=jsonpath='{.status.phase}'=Bound \
    pvc/${PVC} -n "${NAMESPACE}" --timeout=120s 2>/dev/null || \
    warn "PVC ${PVC} not yet bound (may need manual StorageClass)"
done

# ── Step 6: Deploy application services ──────────────────
log "Step 6/8: Deploying application services..."

kubectl apply -f "${K8S_DIR}/deployments.yaml" -n "${NAMESPACE}"
ok "Deployments & Services applied"

# Wait for core services
log "Waiting for deployments to be ready..."
CORE_SERVICES=(redis rabbitmq minio auth-service expense-service sales-service web)
for SVC in "${CORE_SERVICES[@]}"; do
  log "  Waiting for ${SVC}..."
  kubectl rollout status deployment/${SVC} -n "${NAMESPACE}" --timeout=300s 2>/dev/null || \
    warn "  ${SVC} not ready yet"
done
ok "Core services deployed"

# ── Step 7: Apply Ingress, HPA, CronJobs ────────────────
log "Step 7/8: Applying Ingress, HPA, CronJobs..."

kubectl apply -f "${K8S_DIR}/ingress.yaml" 2>/dev/null || \
  warn "Ingress applied (ensure DNS is configured)"
kubectl apply -f "${K8S_DIR}/hpa.yaml" -n "${NAMESPACE}"
kubectl apply -f "${K8S_DIR}/cronjobs.yaml" -n "${NAMESPACE}"
ok "Ingress, HPA, CronJobs applied"

# ── Step 8: Deploy monitoring stack ──────────────────────
log "Step 8/8: Deploying monitoring stack..."

# Create configmaps from monitoring files
kubectl create configmap prometheus-alerts \
  --from-file="${MON_DIR}/prometheus/alerts/" \
  -n "${NAMESPACE}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboards \
  --from-file="${MON_DIR}/grafana/dashboards/" \
  -n "${NAMESPACE}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-provisioning-dashboards \
  --from-file="${MON_DIR}/grafana/provisioning/dashboards.yml" \
  -n "${NAMESPACE}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-provisioning-datasources \
  --from-file="${MON_DIR}/grafana/provisioning/datasources.yml" \
  -n "${NAMESPACE}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f "${MON_DIR}/monitoring-stack.yaml" -n "${NAMESPACE}"
ok "Monitoring stack deployed"

# ── Summary ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN} CaisseFlow Pro — Deployment Complete (${ENV})${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
log "Namespace: ${NAMESPACE}"
echo ""
log "Services:"
kubectl get svc -n "${NAMESPACE}" --no-headers 2>/dev/null | while read -r line; do
  echo "  ${line}"
done
echo ""
log "Pods:"
kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | while read -r line; do
  echo "  ${line}"
done
echo ""

if [[ "$ENV" == "staging" ]]; then
  log "Staging URL: https://staging.caisseflow.com"
  log "Grafana:     https://staging.caisseflow.com:3000 (admin / <secret>)"
else
  log "Production URL: https://app.caisseflow.com"
  log "Grafana:        Internal only via kubectl port-forward svc/grafana 3000:3000 -n ${NAMESPACE}"
fi

echo ""
warn "IMPORTANT: Update secrets with real values:"
warn "  kubectl edit secret app-secrets -n ${NAMESPACE}"
echo ""
ok "Done!"
