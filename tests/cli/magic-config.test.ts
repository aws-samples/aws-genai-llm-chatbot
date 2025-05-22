import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { SystemConfig } from "../../lib/shared/types";

const execAsync = promisify(exec);
const TEST_CONFIG_PATH = path.join(__dirname, "../../bin/config.json");
const CLI_PATH = path.join(__dirname, "../../dist/cli/magic-config.js");

describe("magic-config CLI in non-interactive mode", () => {
  // Backup the original config if it exists
  let originalConfig: string | null = null;

  beforeAll(() => {
    // Save original config if it exists
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      originalConfig = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    }
  });

  afterAll(() => {
    // Restore original config if it existed
    if (originalConfig) {
      fs.writeFileSync(TEST_CONFIG_PATH, originalConfig);
    } else if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  beforeEach(() => {
    // Remove any test config before each test
    if (fs.existsSync(TEST_CONFIG_PATH)) {
      fs.unlinkSync(TEST_CONFIG_PATH);
    }
  });

  it("should create a default configuration with minimal env vars", async () => {
    // Set up minimal environment variables
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "test-prefix",
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Verify the config file was created
    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify basic configuration
    expect(config.prefix).toBe("test-prefix");
    expect(config.createCMKs).toBe(false);
    expect(config.retainOnDelete).toBe(false);
    expect(config.rag.enabled).toBe(false);
    expect(config.bedrock?.enabled).toBeUndefined();
  });

  it("should configure Bedrock when BEDROCK_ENABLE is true", async () => {
    // Set up environment variables for Bedrock
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "test-prefix",
      BEDROCK_ENABLE: "true",
      BEDROCK_REGION: "us-west-2",
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify Bedrock configuration
    expect(config.bedrock?.enabled).toBe(true);
    expect(config.bedrock?.region).toBe("us-west-2");
  });

  it("should configure RAG when RAG_ENABLE is true", async () => {
    // Set up environment variables for RAG
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "test-prefix",
      RAG_ENABLE: "true",
      RAG_OPENSEARCH_ENABLE: "true",
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify RAG configuration
    expect(config.rag.enabled).toBe(true);
    expect(config.rag.engines.opensearch.enabled).toBe(true);
    expect(config.rag.engines.aurora.enabled).toBe(false);
  });

  it("should configure Nexus integration when NEXUS_ENABLE is true", async () => {
    // Set up environment variables for Nexus
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "test-prefix",
      NEXUS_ENABLE: "true",
      NEXUS_GATEWAY_URL: "https://test-gateway.example.com",
      NEXUS_AUTH_CLIENT_ID: "test-client-id",
      NEXUS_AUTH_CLIENT_SECRET: "test-client-secret",
      NEXUS_AUTH_TOKEN_URL: "https://test-token.example.com",
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify Nexus configuration
    expect(config.nexus?.enabled).toBe(true);
    expect(config.nexus?.gatewayUrl).toBe("https://test-gateway.example.com");
    expect(config.nexus?.clientId).toBe("test-client-id");
    expect(config.nexus?.clientSecret).toBe("test-client-secret");
    expect(config.nexus?.tokenUrl).toBe("https://test-token.example.com");
  });

  it("should handle boolean environment variables correctly", async () => {
    // Set up environment variables with various boolean formats
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "test-prefix",
      CREATE_CMKS: "true",
      RETAIN_ON_DELETE: "TRUE",
      DDB_DELETION_PROTECTION: "True",
      BEDROCK_ENABLE: "false",
      RAG_ENABLE: "FALSE",
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify boolean values are parsed correctly
    expect(config.createCMKs).toBe(true);
    expect(config.retainOnDelete).toBe(true);
    expect(config.ddbDeletionProtection).toBe(true);
    // Bedrock is undefined when BEDROCK_ENABLE is false
    expect(config.bedrock).toBeUndefined();
    expect(config.rag.enabled).toBe(false);
  });

  it("should handle complex configuration with multiple features", async () => {
    // Set up environment variables for a complex configuration
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "complex-test",
      BEDROCK_ENABLE: "true",
      BEDROCK_REGION: "us-east-1",
      BEDROCK_GUARDRAILS_ENABLE: "true",
      BEDROCK_GUARDRAILS_ID: "test-guardrail",
      RAG_ENABLE: "true",
      RAG_OPENSEARCH_ENABLE: "true",
      RAG_AURORA_ENABLE: "true",
      RAG_KENDRA_ENABLE: "false",
      NEXUS_ENABLE: "true",
      NEXUS_GATEWAY_URL: "https://test-gateway.example.com",
      NEXUS_AUTH_CLIENT_ID: "test-client-id",
      NEXUS_AUTH_CLIENT_SECRET: "test-client-secret",
      ADVANCED_MONITORING: "true",
      LOG_RETENTION: "14",
      RATE_LIMIT_PER_IP: "500",
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify complex configuration
    expect(config.prefix).toBe("complex-test");

    // Bedrock config
    expect(config.bedrock?.enabled).toBe(true);
    expect(config.bedrock?.region).toBe("us-east-1");
    expect(config.bedrock?.guardrails?.enabled).toBe(true);
    expect(config.bedrock?.guardrails?.identifier).toBe("test-guardrail");

    // RAG config
    expect(config.rag.enabled).toBe(true);
    expect(config.rag.engines.opensearch.enabled).toBe(true);
    expect(config.rag.engines.aurora.enabled).toBe(true);
    expect(config.rag.engines.kendra.enabled).toBe(false);

    // Nexus config
    expect(config.nexus?.enabled).toBe(true);
    expect(config.nexus?.gatewayUrl).toBe("https://test-gateway.example.com");

    // Advanced settings
    expect(config.advancedMonitoring).toBe(true);
    expect(config.logRetention).toBe(14);
    expect(config.rateLimitPerIP).toBe(500);
  });

  it("should use default values when environment variables are not provided", async () => {
    // Set up minimal environment variables
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      // Clear PREFIX if it exists in the environment
      PREFIX: undefined,
    };

    // Run the CLI in non-interactive mode
    await execAsync(`node ${CLI_PATH} --non-interactive`, { env });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify default values
    expect(config.prefix).toBe("genai-chatbot"); // Default prefix
    expect(config.createCMKs).toBe(false);
    expect(config.retainOnDelete).toBe(false);
    expect(config.llms.rateLimitPerIP).toBe(100);
    expect(config.rateLimitPerIP).toBe(400);
    expect(config.logRetention).toBe(7);
  });

  it("should use custom environment variable prefix when specified", async () => {
    // Set up environment variables with custom prefix
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      CUSTOM_PREFIX: "custom-prefix",
      CUSTOM_BEDROCK_ENABLE: "true",
      CUSTOM_BEDROCK_REGION: "us-west-2",
      CUSTOM_RAG_ENABLE: "true",
      CUSTOM_RAG_AURORA_ENABLE: "true",
      // Make sure regular PREFIX doesn't interfere
      PREFIX: "should-be-ignored",
    };

    // Run the CLI in non-interactive mode with custom env prefix
    await execAsync(`node ${CLI_PATH} --non-interactive --env-prefix CUSTOM_`, {
      env,
    });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify configuration with custom prefix
    expect(config.prefix).toBe("custom-prefix");
    expect(config.bedrock?.enabled).toBe(true);
    expect(config.bedrock?.region).toBe("us-west-2");
    expect(config.rag.enabled).toBe(true);
    expect(config.rag.engines.aurora.enabled).toBe(true);
  });

  it("should prioritize prefixed variables over non-prefixed ones", async () => {
    // Set up environment variables with both prefixed and non-prefixed values
    const env = {
      ...process.env,
      SEEDFARMER_DEPLOYMENT: "true",
      PREFIX: "non-prefixed-value",
      CUSTOM_PREFIX: "prefixed-value",
      BEDROCK_ENABLE: "false",
      CUSTOM_BEDROCK_ENABLE: "true",
    };

    // Run the CLI in non-interactive mode with custom env prefix
    await execAsync(`node ${CLI_PATH} --non-interactive --env-prefix CUSTOM_`, {
      env,
    });

    // Read and parse the config
    const configContent = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    const config: SystemConfig = JSON.parse(configContent);

    // Verify prefixed values are used
    expect(config.prefix).toBe("prefixed-value");
    expect(config.bedrock?.enabled).toBe(true);
  });
});
