#!/bin/bash

# =============================================================================
# Tap2Go Docker Build Script - Optimized Multi-Stage Builds
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="johnlloydcallao/tap2go-complete"
REGISTRY="docker.io"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show build time
show_build_time() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    print_success "Build completed in ${minutes}m ${seconds}s"
}

# Function to build with caching optimization
build_optimized() {
    local target=$1
    local tag_suffix=$2
    local start_time=$(date +%s)
    
    print_status "Building optimized Docker image (target: ${target})"
    print_status "Using multi-stage caching for maximum efficiency..."
    
    # Build with BuildKit for advanced caching
    DOCKER_BUILDKIT=1 docker build \
        --target ${target} \
        --tag ${IMAGE_NAME}:${tag_suffix} \
        --tag ${IMAGE_NAME}:latest \
        --cache-from ${IMAGE_NAME}:cache-base \
        --cache-from ${IMAGE_NAME}:cache-deps \
        --cache-from ${IMAGE_NAME}:cache-builder \
        --progress=plain \
        .
    
    show_build_time $start_time
}

# Function to build and push cache layers
build_cache_layers() {
    print_status "Building cache layers for optimal subsequent builds..."
    
    # Build base layer
    print_status "Building base cache layer..."
    DOCKER_BUILDKIT=1 docker build \
        --target base \
        --tag ${IMAGE_NAME}:cache-base \
        --cache-from ${IMAGE_NAME}:cache-base \
        .
    
    # Build dependencies layer
    print_status "Building dependencies cache layer..."
    DOCKER_BUILDKIT=1 docker build \
        --target dependencies \
        --tag ${IMAGE_NAME}:cache-deps \
        --cache-from ${IMAGE_NAME}:cache-base \
        --cache-from ${IMAGE_NAME}:cache-deps \
        .
    
    # Build builder layer
    print_status "Building builder cache layer..."
    DOCKER_BUILDKIT=1 docker build \
        --target builder \
        --tag ${IMAGE_NAME}:cache-builder \
        --cache-from ${IMAGE_NAME}:cache-base \
        --cache-from ${IMAGE_NAME}:cache-deps \
        --cache-from ${IMAGE_NAME}:cache-builder \
        .
}

# Function to push cache layers
push_cache_layers() {
    print_status "Pushing cache layers to registry..."
    docker push ${IMAGE_NAME}:cache-base
    docker push ${IMAGE_NAME}:cache-deps
    docker push ${IMAGE_NAME}:cache-builder
    print_success "Cache layers pushed successfully"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  production    Build production image (default)"
    echo "  development   Build development image with hot reloading"
    echo "  cache         Build and push cache layers for CI/CD"
    echo "  quick         Quick build using existing cache"
    echo "  clean         Clean up Docker images and cache"
    echo "  push          Push images to Docker Hub"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production   # Build optimized production image"
    echo "  $0 development  # Build development image"
    echo "  $0 cache        # Build cache layers for faster subsequent builds"
}

# Main script logic
case "${1:-production}" in
    "production")
        print_status "Building production image..."
        build_optimized "production" "latest"
        print_success "Production image built: ${IMAGE_NAME}:latest"
        ;;
    
    "development")
        print_status "Building development image..."
        build_optimized "development" "dev"
        print_success "Development image built: ${IMAGE_NAME}:dev"
        ;;
    
    "cache")
        print_status "Building cache layers..."
        build_cache_layers
        print_warning "To push cache layers, run: $0 push-cache"
        ;;
    
    "push-cache")
        push_cache_layers
        ;;
    
    "quick")
        print_status "Quick build using cache..."
        start_time=$(date +%s)
        docker build --tag ${IMAGE_NAME}:latest .
        show_build_time $start_time
        ;;
    
    "clean")
        print_status "Cleaning up Docker images and cache..."
        docker system prune -f
        docker image prune -f
        print_success "Cleanup completed"
        ;;
    
    "push")
        print_status "Pushing images to Docker Hub..."
        docker push ${IMAGE_NAME}:latest
        if docker image inspect ${IMAGE_NAME}:dev >/dev/null 2>&1; then
            docker push ${IMAGE_NAME}:dev
        fi
        print_success "Images pushed successfully"
        ;;
    
    "help"|"-h"|"--help")
        show_usage
        ;;
    
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac

print_status "Docker build script completed!"
