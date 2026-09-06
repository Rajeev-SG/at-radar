SHELL := /bin/bash

.PHONY: bootstrap test dev build deploy deploy-worker deploy-web

bootstrap:
	npm install
	npx playwright install --with-deps chromium || npx playwright install chromium

test:
	npm run lint
	npm run typecheck
	npm run test

dev:
	npm run dev

build:
	npm run build

deploy: test
	node scripts/deploy-cloudflare.mjs
