
set shell := ["bash", "-cu"]

# Generic Clever Cloud deployment helper.
cc_deploy remote branch="main":
  git fetch origin {{branch}} && git push -f {{remote}} {{branch}}:master

# Deploy the Mastra service to Clever Cloud.
deploy-mastra branch="main":
  just cc_deploy clever_bs_mastra {{branch}}

# Deploy the Mastra service to Clever Cloud.
deploy-front branch="main":
  just cc_deploy clever_bs_front {{branch}}

# Deploy all configured services to Clever Cloud.
deploy branch="main": (deploy-mastra branch) (deploy-front branch)

# Start the local Docker Compose stack.
up:
  docker compose up --build
