# Define services
FE_DIR := ng-frontend
BE_DIR := node-backend
PY_DIR := python-search-api

.PHONY: dev-fe dev-be dev-py dev-all init

# 1. New target to run your entry script
init:
	chmod +x local.entry.sh
	./local.entry.sh

# 2. Individual targets with terminal spawning

dev-py: init
# 	gnome-terminal --title="Python Search" -- bash -c "
	cd $(PY_DIR) doppler setup --project postair --config dev_nk --no-interactive && doppler run -- python app.py --reload

dev-be: 
# 	gnome-terminal --title="Node BE" -- bash -c "
	cd $(BE_DIR) doppler setup --project postair --config dev_nk --no-interactive && doppler run -- npm run dev


dev-fe:
# 	gnome-terminal --title="Angular FE" -- bash -c "	
	cd $(FE_DIR) doppler setup --project postair --config dev_nk --no-interactive && doppler run -- ng serve --open

# 3. Launch all (No -j 3 needed anymore because gnome-terminal backgrounding handles it)
dev-all: dev-fe dev-be dev-py