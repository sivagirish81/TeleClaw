package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/example/teleclaw/broker/internal/api"
	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/manifests"
	"github.com/example/teleclaw/broker/internal/runner"
	"github.com/example/teleclaw/broker/internal/store"
)

func main() {
	cfgPath := os.Getenv("TELECLAW_BROKER_CONFIG")
	if cfgPath == "" {
		cfgPath = filepath.Join("configs", "broker.yaml")
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	manifestIndex, err := manifests.LoadDir(cfg.RunbooksDir)
	if err != nil {
		log.Fatalf("load manifests: %v", err)
	}

	jobStore, err := store.NewJSONStore(cfg.StorePath)
	if err != nil {
		log.Fatalf("init store: %v", err)
	}

	runbookRunner := runner.NewDefaultRunner(cfg)
	srv := api.NewServer(cfg, manifestIndex, jobStore, runbookRunner)

	log.Printf("teleclaw broker listening on %s", cfg.ListenAddress)
	if err := http.ListenAndServe(cfg.ListenAddress, srv.Routes()); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
