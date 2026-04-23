package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	ListenAddress string         `yaml:"listen_address"`
	RunbooksDir   string         `yaml:"runbooks_dir"`
	StorePath     string         `yaml:"store_path"`
	Teleport      TeleportConfig `yaml:"teleport"`
}

type TeleportConfig struct {
	Enabled        bool   `yaml:"enabled"`
	TshPath        string `yaml:"tsh_path"`
	KubectlPath    string `yaml:"kubectl_path"`
	Proxy          string `yaml:"proxy"`
	KubeCluster    string `yaml:"kube_cluster"`
	LoginTTL       string `yaml:"login_ttl"`
	LoginTimeout   string `yaml:"login_timeout"`
	CommandTimeout string `yaml:"command_timeout"`
}

func defaultConfig() Config {
	return Config{
		ListenAddress: ":8080",
		RunbooksDir:   filepath.Join("..", "runbooks"),
		StorePath:     filepath.Join("..", "tmp", "jobs.json"),
		Teleport: TeleportConfig{
			Enabled:        false,
			TshPath:        "tsh",
			KubectlPath:    "kubectl",
			Proxy:          "",
			KubeCluster:    "",
			LoginTTL:       "15m",
			LoginTimeout:   "30s",
			CommandTimeout: "20s",
		},
	}
}

func Load(path string) (Config, error) {
	cfg := defaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}

	if cfg.ListenAddress == "" {
		cfg.ListenAddress = ":8080"
	}
	if cfg.RunbooksDir == "" {
		cfg.RunbooksDir = filepath.Join("..", "runbooks")
	}
	if cfg.StorePath == "" {
		cfg.StorePath = filepath.Join("..", "tmp", "jobs.json")
	}
	if cfg.Teleport.TshPath == "" {
		cfg.Teleport.TshPath = "tsh"
	}
	if cfg.Teleport.KubectlPath == "" {
		cfg.Teleport.KubectlPath = "kubectl"
	}
	if cfg.Teleport.LoginTTL == "" {
		cfg.Teleport.LoginTTL = "15m"
	}
	if cfg.Teleport.LoginTimeout == "" {
		cfg.Teleport.LoginTimeout = "30s"
	}
	if cfg.Teleport.CommandTimeout == "" {
		cfg.Teleport.CommandTimeout = "20s"
	}

	return cfg, nil
}
