#!/usr/bin/env node
"use strict";
// Copyright 2021 Amazon.com.
// SPDX-License-Identifier: MIT
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const enquirer = require("enquirer");
const types_1 = require("../lib/shared/types");
const version_js_1 = require("./version.js");
const fs = require("fs");
const versionRegExp = /\d+.\d+.\d+/;
const embeddingModels = [
    {
        provider: "sagemaker",
        name: "intfloat/multilingual-e5-large",
        dimensions: 1024,
    },
    {
        provider: "sagemaker",
        name: "sentence-transformers/all-MiniLM-L6-v2",
        dimensions: 384,
    },
    {
        provider: "bedrock",
        name: "amazon.titan-e1t-medium",
        dimensions: 4096,
    },
    {
        provider: "openai",
        name: "text-embedding-ada-002",
        dimensions: 1536,
    },
];
/**
 * Main entry point
 */
(async () => {
    let program = new commander_1.Command().description('Creates a new chatbot configuration');
    program.version(version_js_1.LIB_VERSION);
    program
        .option('-p, --prefix <prefix>', 'The prefix for the stack');
    program.action(async (options) => {
        if (fs.existsSync("./bin/config.json")) {
            const config = JSON.parse(fs.readFileSync("./bin/config.json").toString("utf8"));
            options.prefix = config.prefix;
            options.bedrockEnable = config.bedrock?.enabled;
            options.bedrockRegion = config.bedrock?.region;
            options.bedrockEndpoint = config.bedrock?.endpointUrl;
            options.bedrockRoleArn = config.bedrock?.roleArn;
            options.sagemakerLLMs = config.llms.sagemaker;
            options.ragsToEnable = Object.keys(config.rag.engines).filter((v) => config.rag.engines[v].enabled);
            options.embeddings = config.rag.embeddingsModels.map((m) => m.name);
            options.defaultEmbedding = config.rag.embeddingsModels.filter((m) => m.default)[0].name;
            options.kendraExternal = config.rag.engines.kendra.external;
        }
        try {
            await processCreateOptions(options);
        }
        catch (err) {
            console.error("Could not complete the operation.");
            console.error(err.message);
            process.exit(1);
        }
    });
    program.parse(process.argv);
})();
function createConfig(config) {
    fs.writeFileSync("./bin/config.json", JSON.stringify(config, undefined, 2));
    console.log("New config written to ./bin/config.json");
}
/**
 * Prompts the user for missing options
 *
 * @param options Options provided via the CLI
 * @returns The complete options
 */
async function processCreateOptions(options) {
    let questions = [
        {
            type: 'input',
            name: 'prefix',
            message: 'Prefix to differentiate this deployment',
            initial: options.prefix,
            askAnswered: false,
        },
        {
            type: 'confirm',
            name: 'bedrockEnable',
            message: 'Do you have access to Bedrock and want to enable it',
            initial: true
        },
        {
            type: 'select',
            name: 'bedrockRegion',
            message: 'Region where Bedrock is available',
            choices: [types_1.SupportedRegion.US_EAST_1, types_1.SupportedRegion.US_WEST_2, types_1.SupportedRegion.EU_CENTRAL_1, types_1.SupportedRegion.AP_SOUTHEAST_1],
            initial: options.bedrockRegion ?? 'us-east-1',
            skip() {
                return !this.state.answers.bedrockEnable;
            }
        },
        {
            type: 'input',
            name: 'bedrockEndpoint',
            message: 'Bedrock endpoint - leave as is for standard endpoint',
            initial() { return `https://bedrock.${this.state.answers.bedrockRegion}.amazonaws.com`; }
        },
        {
            type: 'input',
            name: 'bedrockRoleArn',
            message: 'Cross account role arn to invoke Bedrock - leave empty if Bedrock is in same account',
            validate: (v) => {
                const valid = RegExp(/arn:aws:iam::\d+:role\/[\w-_]+/).test(v);
                return (v.length === 0) || valid;
            },
            initial: options.bedrockRoleArn || ''
        },
        {
            type: 'multiselect',
            name: 'sagemakerLLMs',
            message: 'Which Sagemaker LLMs do you want to enable',
            choices: Object.values(types_1.SupportedSageMakerLLM),
            initial: options.sagemakerLLMs || []
        },
        {
            type: 'confirm',
            name: 'enableRag',
            message: 'Do you want to enable RAG',
            initial: options.enableRag || true
        },
        {
            type: "multiselect",
            name: "ragsToEnable",
            message: 'Which datastores do you want to enable for RAG',
            choices: [
                { message: 'Aurora', name: 'aurora' },
                // Not yet supported
                // {message:'OpenSearch', name:'opensearch'}, 
                // {message:'Kendra (managed)', name:'kendra'}, 
            ],
            skip: function () {
                // workaround for https://github.com/enquirer/enquirer/issues/298
                this.state._choices = this.state.choices;
                return !this.state.answers.enableRag;
            },
            initial: options.ragsToEnable || []
        },
        {
            type: "confirm",
            name: "kendra",
            message: "Do you want to add existing Kendra indexes",
            initial: !!options.kendraExternal || false,
            skip: function () {
                // workaround for https://github.com/enquirer/enquirer/issues/298
                this.state._choices = this.state.choices;
                return !this.state.answers.enableRag;
            }
        },
    ];
    const answers = await enquirer.prompt(questions);
    const kendraExternal = [];
    let newKendra = answers.enableRag && answers.kendra;
    // if (options.kendraExternal) {
    //     options.kendraExternal.forEach((v: any) => console.log(v))
    // }
    while (newKendra === true) {
        const kendraQ = [
            {
                type: "input",
                name: "name",
                message: "Kendra source name"
            },
            {
                type: "autocomplete",
                limit: 8,
                name: "region",
                choices: Object.values(types_1.SupportedRegion),
                message: "Region of the Kendra index"
            },
            {
                type: "input",
                name: "roleArn",
                message: "Cross account role Arn to assume to call Kendra, leave empty if not needed",
                validate: (v) => {
                    const valid = RegExp(/arn:aws:iam::\d+:role\/[\w-_]+/).test(v);
                    return (v.length === 0) || valid;
                },
                initial: ""
            },
            {
                type: "input",
                name: "kendraId",
                message: "Kendra ID",
                validate(v) {
                    return RegExp(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/).test(v);
                }
            },
            {
                type: "confirm",
                name: "newKendra",
                message: "Do you want to add another Kendra source",
                default: false
            },
        ];
        const kendraInstance = await enquirer.prompt(kendraQ);
        const ext = (({ name, roleArn, kendraId, region }) => ({ name, roleArn, kendraId, region }))(kendraInstance);
        if (ext.roleArn === '')
            ext.roleArn = undefined;
        kendraExternal.push({
            enabled: true,
            external: ext
        });
        newKendra = kendraInstance.newKendra;
    }
    const modelsPrompts = [
        {
            type: 'select',
            name: 'defaultEmbedding',
            message: 'Which is the default embedding model',
            choices: embeddingModels.map(m => ({ name: m.name, value: m })),
            initial: options.defaultEmbedding || undefined
        }
    ];
    const models = await enquirer.prompt(modelsPrompts);
    // Create the config object
    const config = {
        prefix: answers.prefix,
        bedrock: (answers.bedrockEnable ? {
            enabled: answers.bedrockEnable,
            region: answers.bedrockRegion,
            roleArn: answers.bedrockRoleArn === '' ? undefined : answers.bedrockRoleArn,
            endpointUrl: answers.bedrockEndpoint
        } : undefined),
        llms: {
            sagemaker: answers.sagemakerLLMs,
        },
        rag: {
            enabled: answers.enableRag,
            engines: {
                aurora: {
                    enabled: answers.ragsToEnable.includes('aurora')
                },
                opensearch: {
                    enabled: answers.ragsToEnable.includes('opensearch')
                },
                kendra: { enabled: false, external: [{}] },
            },
            embeddingsModels: [{}],
            crossEncoderModels: [
                {
                    provider: "sagemaker",
                    name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
                    default: true,
                }
            ]
        },
    };
    config.rag.engines.kendra.enabled = answers.ragsToEnable.includes('kendra');
    config.rag.engines.kendra.external = [...kendraExternal];
    config.rag.embeddingsModels = embeddingModels;
    config.rag.embeddingsModels.forEach((m) => { if (m.name === models.defaultEmbedding) {
        m.default = true;
    } });
    console.log("\n✨ This is the chosen configuration:\n");
    console.log(JSON.stringify(config, undefined, 2));
    (await enquirer.prompt([{
            type: "confirm",
            name: "create",
            message: "Do you want to create a new config based on the above",
            initial: false
        }])).create ? createConfig(config) : console.log("Skipping");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFnaWMtY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFnaWMtY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsNkJBQTZCO0FBQzdCLCtCQUErQjs7QUFFL0IseUNBQW9DO0FBQ3BDLHFDQUFxQztBQUNyQywrQ0FBMEY7QUFDMUYsNkNBQTJDO0FBQzNDLHlCQUF5QjtBQUd6QixNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUM7QUFFcEMsTUFBTSxlQUFlLEdBQUc7SUFDcEI7UUFDSSxRQUFRLEVBQUUsV0FBVztRQUNyQixJQUFJLEVBQUUsZ0NBQWdDO1FBQ3RDLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsV0FBVztRQUNyQixJQUFJLEVBQUUsd0NBQXdDO1FBQzlDLFVBQVUsRUFBRSxHQUFHO0tBQ2hCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsU0FBUztRQUNuQixJQUFJLEVBQUUseUJBQXlCO1FBQy9CLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsUUFBUTtRQUNsQixJQUFJLEVBQUUsd0JBQXdCO1FBQzlCLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0NBQ04sQ0FBQztBQUVGOztHQUVHO0FBRUgsQ0FBQyxLQUFLLElBQUksRUFBRTtJQUNSLElBQUksT0FBTyxHQUFHLElBQUksbUJBQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQy9FLE9BQU8sQ0FBQyxPQUFPLENBQUMsd0JBQVcsQ0FBQyxDQUFDO0lBRTdCLE9BQU87U0FDRixNQUFNLENBQUMsdUJBQXVCLEVBQUUsMEJBQTBCLENBQUMsQ0FBQTtJQUVoRSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUMsRUFBRTtRQUM1QixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUNwQyxNQUFNLE1BQU0sR0FBaUIsSUFBSSxDQUFDLEtBQUss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QU8sQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtRQUFFLENBQUMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0tBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUNqSCxPQUFPLENBQUMsR0FBRyxDQUFDLHlDQUF5QyxDQUFDLENBQUE7SUFDdEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRCxDQUFDLE1BQU0sUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3JCLElBQUksRUFBRSxTQUFTO1lBQ2YsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsdURBQXVEO1lBQ2hFLE9BQU8sRUFBRSxLQUFLO1NBQ2pCLENBQUMsQ0FBQyxDQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDekUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcblxuLy8gQ29weXJpZ2h0IDIwMjEgQW1hem9uLmNvbS5cbi8vIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBNSVRcblxuaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NvbW1hbmRlcic7XG5pbXBvcnQgKiBhcyBlbnF1aXJlciBmcm9tICdlbnF1aXJlcic7XG5pbXBvcnQgeyBTdXBwb3J0ZWRSZWdpb24sIFN1cHBvcnRlZFNhZ2VNYWtlckxMTSwgU3lzdGVtQ29uZmlnfSBmcm9tICcuLi9saWIvc2hhcmVkL3R5cGVzJztcbmltcG9ydCB7IExJQl9WRVJTSU9OIH0gZnJvbSAnLi92ZXJzaW9uLmpzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcblxuXG5jb25zdCB2ZXJzaW9uUmVnRXhwID0gL1xcZCsuXFxkKy5cXGQrLztcblxuY29uc3QgZW1iZWRkaW5nTW9kZWxzID0gW1xuICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwic2FnZW1ha2VyXCIsXG4gICAgICAgIG5hbWU6IFwiaW50ZmxvYXQvbXVsdGlsaW5ndWFsLWU1LWxhcmdlXCIsXG4gICAgICAgIGRpbWVuc2lvbnM6IDEwMjQsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBwcm92aWRlcjogXCJzYWdlbWFrZXJcIixcbiAgICAgICAgbmFtZTogXCJzZW50ZW5jZS10cmFuc2Zvcm1lcnMvYWxsLU1pbmlMTS1MNi12MlwiLFxuICAgICAgICBkaW1lbnNpb25zOiAzODQsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBwcm92aWRlcjogXCJiZWRyb2NrXCIsXG4gICAgICAgIG5hbWU6IFwiYW1hem9uLnRpdGFuLWUxdC1tZWRpdW1cIixcbiAgICAgICAgZGltZW5zaW9uczogNDA5NixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHByb3ZpZGVyOiBcIm9wZW5haVwiLFxuICAgICAgICBuYW1lOiBcInRleHQtZW1iZWRkaW5nLWFkYS0wMDJcIixcbiAgICAgICAgZGltZW5zaW9uczogMTUzNixcbiAgICAgIH0sXG5dO1xuXG4vKipcbiAqIE1haW4gZW50cnkgcG9pbnRcbiAqL1xuXG4oYXN5bmMgKCkgPT57IFxuICAgIGxldCBwcm9ncmFtID0gbmV3IENvbW1hbmQoKS5kZXNjcmlwdGlvbignQ3JlYXRlcyBhIG5ldyBjaGF0Ym90IGNvbmZpZ3VyYXRpb24nKTtcbiAgICBwcm9ncmFtLnZlcnNpb24oTElCX1ZFUlNJT04pO1xuICAgIFxuICAgIHByb2dyYW1cbiAgICAgICAgLm9wdGlvbignLXAsIC0tcHJlZml4IDxwcmVmaXg+JywgJ1RoZSBwcmVmaXggZm9yIHRoZSBzdGFjaycpXG5cbiAgICBwcm9ncmFtLmFjdGlvbihhc3luYyAob3B0aW9ucyk9PiB7IFxuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhcIi4vYmluL2NvbmZpZy5qc29uXCIpKSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWc6IFN5c3RlbUNvbmZpZyA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKFwiLi9iaW4vY29uZmlnLmpzb25cIikudG9TdHJpbmcoXCJ1dGY4XCIpKTtcbiAgICAgICAgICAgIG9wdGlvbnMucHJlZml4ID0gY29uZmlnLnByZWZpeDtcbiAgICAgICAgICAgIG9wdGlvbnMuYmVkcm9ja0VuYWJsZSA9IGNvbmZpZy5iZWRyb2NrPy5lbmFibGVkO1xuICAgICAgICAgICAgb3B0aW9ucy5iZWRyb2NrUmVnaW9uID0gY29uZmlnLmJlZHJvY2s/LnJlZ2lvbjtcbiAgICAgICAgICAgIG9wdGlvbnMuYmVkcm9ja0VuZHBvaW50ID0gY29uZmlnLmJlZHJvY2s/LmVuZHBvaW50VXJsO1xuICAgICAgICAgICAgb3B0aW9ucy5iZWRyb2NrUm9sZUFybiA9IGNvbmZpZy5iZWRyb2NrPy5yb2xlQXJuO1xuICAgICAgICAgICAgb3B0aW9ucy5zYWdlbWFrZXJMTE1zID0gY29uZmlnLmxsbXMuc2FnZW1ha2VyO1xuICAgICAgICAgICAgb3B0aW9ucy5yYWdzVG9FbmFibGUgPSBPYmplY3Qua2V5cyhjb25maWcucmFnLmVuZ2luZXMpLmZpbHRlcigodjpzdHJpbmcpID0+IChjb25maWcucmFnLmVuZ2luZXMgYXMgYW55KVt2XS5lbmFibGVkKVxuICAgICAgICAgICAgb3B0aW9ucy5lbWJlZGRpbmdzID0gY29uZmlnLnJhZy5lbWJlZGRpbmdzTW9kZWxzLm1hcCgobTphbnkpID0+IG0ubmFtZSk7XG4gICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRFbWJlZGRpbmcgPSBjb25maWcucmFnLmVtYmVkZGluZ3NNb2RlbHMuZmlsdGVyKChtOiBhbnkpID0+IG0uZGVmYXVsdClbMF0ubmFtZTtcbiAgICAgICAgICAgIG9wdGlvbnMua2VuZHJhRXh0ZXJuYWwgPSBjb25maWcucmFnLmVuZ2luZXMua2VuZHJhLmV4dGVybmFsO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ3JlYXRlT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJDb3VsZCBub3QgY29tcGxldGUgdGhlIG9wZXJhdGlvbi5cIik7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIHByb2dyYW0ucGFyc2UocHJvY2Vzcy5hcmd2KTtcbn0gKSgpO1xuXG5mdW5jdGlvbiBjcmVhdGVDb25maWcoY29uZmlnOiBhbnkpOiB2b2lkIHtcbiAgICBmcy53cml0ZUZpbGVTeW5jKFwiLi9iaW4vY29uZmlnLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkoY29uZmlnLCB1bmRlZmluZWQsIDIpKTtcbiAgICBjb25zb2xlLmxvZyhcIk5ldyBjb25maWcgd3JpdHRlbiB0byAuL2Jpbi9jb25maWcuanNvblwiKVxufVxuXG4vKipcbiAqIFByb21wdHMgdGhlIHVzZXIgZm9yIG1pc3Npbmcgb3B0aW9uc1xuICogXG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHByb3ZpZGVkIHZpYSB0aGUgQ0xJXG4gKiBAcmV0dXJucyBUaGUgY29tcGxldGUgb3B0aW9uc1xuICovXG5hc3luYyBmdW5jdGlvbiBwcm9jZXNzQ3JlYXRlT3B0aW9ucyhvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsZXQgcXVlc3Rpb25zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnaW5wdXQnLFxuICAgICAgICAgICAgbmFtZTogJ3ByZWZpeCcsXG4gICAgICAgICAgICBtZXNzYWdlOiAnUHJlZml4IHRvIGRpZmZlcmVudGlhdGUgdGhpcyBkZXBsb3ltZW50JyxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMucHJlZml4LFxuICAgICAgICAgICAgYXNrQW5zd2VyZWQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnY29uZmlybScsXG4gICAgICAgICAgICBuYW1lOiAnYmVkcm9ja0VuYWJsZScsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRG8geW91IGhhdmUgYWNjZXNzIHRvIEJlZHJvY2sgYW5kIHdhbnQgdG8gZW5hYmxlIGl0JyxcbiAgICAgICAgICAgIGluaXRpYWw6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICBuYW1lOiAnYmVkcm9ja1JlZ2lvbicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnUmVnaW9uIHdoZXJlIEJlZHJvY2sgaXMgYXZhaWxhYmxlJyxcbiAgICAgICAgICAgIGNob2ljZXM6IFtTdXBwb3J0ZWRSZWdpb24uVVNfRUFTVF8xICwgU3VwcG9ydGVkUmVnaW9uLlVTX1dFU1RfMiwgU3VwcG9ydGVkUmVnaW9uLkVVX0NFTlRSQUxfMSwgU3VwcG9ydGVkUmVnaW9uLkFQX1NPVVRIRUFTVF8xIF0sXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLmJlZHJvY2tSZWdpb24gPz8gJ3VzLWVhc3QtMScsXG4gICAgICAgICAgICBza2lwKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhKHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmJlZHJvY2tFbmFibGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2lucHV0JyxcbiAgICAgICAgICAgIG5hbWU6ICdiZWRyb2NrRW5kcG9pbnQnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0JlZHJvY2sgZW5kcG9pbnQgLSBsZWF2ZSBhcyBpcyBmb3Igc3RhbmRhcmQgZW5kcG9pbnQnLFxuICAgICAgICAgICAgaW5pdGlhbCgpIHsgcmV0dXJuICBgaHR0cHM6Ly9iZWRyb2NrLiR7KHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmJlZHJvY2tSZWdpb259LmFtYXpvbmF3cy5jb21gfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnaW5wdXQnLFxuICAgICAgICAgICAgbmFtZTogJ2JlZHJvY2tSb2xlQXJuJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdDcm9zcyBhY2NvdW50IHJvbGUgYXJuIHRvIGludm9rZSBCZWRyb2NrIC0gbGVhdmUgZW1wdHkgaWYgQmVkcm9jayBpcyBpbiBzYW1lIGFjY291bnQnLFxuICAgICAgICAgICAgdmFsaWRhdGU6ICh2OiBzdHJpbmcpID0+IHsgXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsaWQgPSBSZWdFeHAoL2Fybjphd3M6aWFtOjpcXGQrOnJvbGVcXC9bXFx3LV9dKy8pLnRlc3Qodik7XG4gICAgICAgICAgICAgICAgcmV0dXJuICh2Lmxlbmd0aCA9PT0gMCkgfHwgdmFsaWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbDogb3B0aW9ucy5iZWRyb2NrUm9sZUFybiB8fCAnJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbXVsdGlzZWxlY3QnLFxuICAgICAgICAgICAgbmFtZTogJ3NhZ2VtYWtlckxMTXMnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1doaWNoIFNhZ2VtYWtlciBMTE1zIGRvIHlvdSB3YW50IHRvIGVuYWJsZScsXG4gICAgICAgICAgICBjaG9pY2VzOiBPYmplY3QudmFsdWVzKFN1cHBvcnRlZFNhZ2VNYWtlckxMTSksXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLnNhZ2VtYWtlckxMTXMgfHwgW11cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2NvbmZpcm0nLFxuICAgICAgICAgICAgbmFtZTogJ2VuYWJsZVJhZycsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRG8geW91IHdhbnQgdG8gZW5hYmxlIFJBRycsXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLmVuYWJsZVJhZyB8fCB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6IFwibXVsdGlzZWxlY3RcIixcbiAgICAgICAgICAgIG5hbWU6IFwicmFnc1RvRW5hYmxlXCIsXG4gICAgICAgICAgICBtZXNzYWdlOiAnV2hpY2ggZGF0YXN0b3JlcyBkbyB5b3Ugd2FudCB0byBlbmFibGUgZm9yIFJBRycsXG4gICAgICAgICAgICBjaG9pY2VzOiBbIFxuICAgICAgICAgICAgICAgIHttZXNzYWdlOidBdXJvcmEnLCBuYW1lOidhdXJvcmEnfSwgXG4gICAgICAgICAgICAgICAgLy8gTm90IHlldCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICAvLyB7bWVzc2FnZTonT3BlblNlYXJjaCcsIG5hbWU6J29wZW5zZWFyY2gnfSwgXG4gICAgICAgICAgICAgICAgLy8ge21lc3NhZ2U6J0tlbmRyYSAobWFuYWdlZCknLCBuYW1lOidrZW5kcmEnfSwgXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgc2tpcDogZnVuY3Rpb24gKCk6Ym9vbGVhbiB7XG4gICAgICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2VucXVpcmVyL2VucXVpcmVyL2lzc3Vlcy8yOThcbiAgICAgICAgICAgICAgICAodGhpcyBhcyBhbnkpLnN0YXRlLl9jaG9pY2VzID0gKHRoaXMgYXMgYW55KS5zdGF0ZS5jaG9pY2VzO1xuICAgICAgICAgICAgICAgIHJldHVybiAhKHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmVuYWJsZVJhZztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLnJhZ3NUb0VuYWJsZSB8fCBbXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiBcImNvbmZpcm1cIixcbiAgICAgICAgICAgIG5hbWU6IFwia2VuZHJhXCIsXG4gICAgICAgICAgICBtZXNzYWdlOiBcIkRvIHlvdSB3YW50IHRvIGFkZCBleGlzdGluZyBLZW5kcmEgaW5kZXhlc1wiLFxuICAgICAgICAgICAgaW5pdGlhbDogISFvcHRpb25zLmtlbmRyYUV4dGVybmFsIHx8IGZhbHNlLFxuICAgICAgICAgICAgc2tpcDogZnVuY3Rpb24gKCk6Ym9vbGVhbiB7IFxuICAgICAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9lbnF1aXJlci9lbnF1aXJlci9pc3N1ZXMvMjk4XG4gICAgICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5zdGF0ZS5fY2hvaWNlcyA9ICh0aGlzIGFzIGFueSkuc3RhdGUuY2hvaWNlcztcbiAgICAgICAgICAgICAgICByZXR1cm4gISh0aGlzIGFzIGFueSkuc3RhdGUuYW5zd2Vycy5lbmFibGVSYWc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgXVxuICAgIGNvbnN0IGFuc3dlcnM6YW55ID0gYXdhaXQgZW5xdWlyZXIucHJvbXB0KHF1ZXN0aW9ucyk7XG4gICAgY29uc3Qga2VuZHJhRXh0ZXJuYWwgPSBbXVxuICAgIGxldCBuZXdLZW5kcmEgPSBhbnN3ZXJzLmVuYWJsZVJhZyAmJiBhbnN3ZXJzLmtlbmRyYVxuXG4gICAgLy8gaWYgKG9wdGlvbnMua2VuZHJhRXh0ZXJuYWwpIHtcbiAgICAvLyAgICAgb3B0aW9ucy5rZW5kcmFFeHRlcm5hbC5mb3JFYWNoKCh2OiBhbnkpID0+IGNvbnNvbGUubG9nKHYpKVxuICAgIC8vIH1cbiAgICB3aGlsZSAobmV3S2VuZHJhID09PSB0cnVlKSB7XG4gICAgICAgIGNvbnN0IGtlbmRyYVEgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJpbnB1dFwiLFxuICAgICAgICAgICAgICAgIG5hbWU6IFwibmFtZVwiLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiS2VuZHJhIHNvdXJjZSBuYW1lXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJhdXRvY29tcGxldGVcIixcbiAgICAgICAgICAgICAgICBsaW1pdDo4LFxuICAgICAgICAgICAgICAgIG5hbWU6IFwicmVnaW9uXCIsXG4gICAgICAgICAgICAgICAgY2hvaWNlczogT2JqZWN0LnZhbHVlcyhTdXBwb3J0ZWRSZWdpb24pLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiUmVnaW9uIG9mIHRoZSBLZW5kcmEgaW5kZXhcIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImlucHV0XCIsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJyb2xlQXJuXCIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJDcm9zcyBhY2NvdW50IHJvbGUgQXJuIHRvIGFzc3VtZSB0byBjYWxsIEtlbmRyYSwgbGVhdmUgZW1wdHkgaWYgbm90IG5lZWRlZFwiLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRlOiAodjogc3RyaW5nKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWxpZCA9IFJlZ0V4cCgvYXJuOmF3czppYW06OlxcZCs6cm9sZVxcL1tcXHctX10rLykudGVzdCh2KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICh2Lmxlbmd0aCA9PT0gMCkgfHwgdmFsaWQ7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpbml0aWFsOiBcIlwiXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiaW5wdXRcIixcbiAgICAgICAgICAgICAgICBuYW1lOiBcImtlbmRyYUlkXCIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJLZW5kcmEgSURcIixcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZSh2OiBzdHJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFJlZ0V4cCgvXFx3ezh9LVxcd3s0fS1cXHd7NH0tXFx3ezR9LVxcd3sxMn0vKS50ZXN0KHYpXG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiY29uZmlybVwiLFxuICAgICAgICAgICAgICAgIG5hbWU6IFwibmV3S2VuZHJhXCIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJEbyB5b3Ugd2FudCB0byBhZGQgYW5vdGhlciBLZW5kcmEgc291cmNlXCIsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgICAgY29uc3Qga2VuZHJhSW5zdGFuY2U6YW55ID0gYXdhaXQgZW5xdWlyZXIucHJvbXB0KGtlbmRyYVEpO1xuICAgICAgICBjb25zdCBleHQgPSAoKHtuYW1lLCByb2xlQXJuLCBrZW5kcmFJZCwgcmVnaW9ufSkgPT4gKHtuYW1lLCByb2xlQXJuLCBrZW5kcmFJZCwgcmVnaW9ufSkpKGtlbmRyYUluc3RhbmNlKVxuICAgICAgICBpZiAoZXh0LnJvbGVBcm4gPT09ICcnKSBleHQucm9sZUFybiA9IHVuZGVmaW5lZDtcbiAgICAgICAga2VuZHJhRXh0ZXJuYWwucHVzaCh7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgZXh0ZXJuYWw6IGV4dFxuICAgICAgICB9KVxuICAgICAgICBuZXdLZW5kcmEgPSBrZW5kcmFJbnN0YW5jZS5uZXdLZW5kcmFcbiAgICB9XG4gICAgY29uc3QgbW9kZWxzUHJvbXB0cyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICBuYW1lOiAnZGVmYXVsdEVtYmVkZGluZycsXG4gICAgICAgICAgICBtZXNzYWdlOiAnV2hpY2ggaXMgdGhlIGRlZmF1bHQgZW1iZWRkaW5nIG1vZGVsJyxcbiAgICAgICAgICAgIGNob2ljZXM6IGVtYmVkZGluZ01vZGVscy5tYXAobSA9PiAoe25hbWU6IG0ubmFtZSwgdmFsdWU6IG19KSksXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLmRlZmF1bHRFbWJlZGRpbmcgfHwgdW5kZWZpbmVkXG4gICAgICAgIH1cbiAgICBdXG4gICAgY29uc3QgbW9kZWxzOiBhbnkgPSBhd2FpdCBlbnF1aXJlci5wcm9tcHQobW9kZWxzUHJvbXB0cyk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIGNvbmZpZyBvYmplY3RcbiAgICBjb25zdCBjb25maWcgPSB7IFxuICAgICAgICBwcmVmaXg6IGFuc3dlcnMucHJlZml4LCBcbiAgICAgICAgYmVkcm9jazogKGFuc3dlcnMuYmVkcm9ja0VuYWJsZSA/IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IGFuc3dlcnMuYmVkcm9ja0VuYWJsZSxcbiAgICAgICAgICAgIHJlZ2lvbjogYW5zd2Vycy5iZWRyb2NrUmVnaW9uLFxuICAgICAgICAgICAgcm9sZUFybjogYW5zd2Vycy5iZWRyb2NrUm9sZUFybiA9PT0gJycgPyB1bmRlZmluZWQgOiBhbnN3ZXJzLmJlZHJvY2tSb2xlQXJuLFxuICAgICAgICAgICAgZW5kcG9pbnRVcmw6IGFuc3dlcnMuYmVkcm9ja0VuZHBvaW50XG4gICAgICAgIH0gOiB1bmRlZmluZWQpLFxuICAgICAgICBsbG1zOiB7XG4gICAgICAgICAgICBzYWdlbWFrZXI6IGFuc3dlcnMuc2FnZW1ha2VyTExNcyxcbiAgICAgICAgfSwgXG4gICAgICAgIHJhZzoge1xuICAgICAgICAgICAgZW5hYmxlZDogYW5zd2Vycy5lbmFibGVSYWcsXG4gICAgICAgICAgICBlbmdpbmVzOiB7XG4gICAgICAgICAgICAgICAgYXVyb3JhOiB7XG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGFuc3dlcnMucmFnc1RvRW5hYmxlLmluY2x1ZGVzKCdhdXJvcmEnKVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgb3BlbnNlYXJjaDoge1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBhbnN3ZXJzLnJhZ3NUb0VuYWJsZS5pbmNsdWRlcygnb3BlbnNlYXJjaCcpXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBrZW5kcmE6IHsgZW5hYmxlZDogZmFsc2UsIGV4dGVybmFsOiBbe31dIH0sXG5cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbWJlZGRpbmdzTW9kZWxzOiBbIHt9IF0sXG4gICAgICAgICAgICBjcm9zc0VuY29kZXJNb2RlbHM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHByb3ZpZGVyOiBcInNhZ2VtYWtlclwiLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcImNyb3NzLWVuY29kZXIvbXMtbWFyY28tTWluaUxNLUwtMTItdjJcIixcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0sICAgIFxuICAgIH1cbiAgICBjb25maWcucmFnLmVuZ2luZXMua2VuZHJhLmVuYWJsZWQgPSBhbnN3ZXJzLnJhZ3NUb0VuYWJsZS5pbmNsdWRlcygna2VuZHJhJyk7XG4gICAgY29uZmlnLnJhZy5lbmdpbmVzLmtlbmRyYS5leHRlcm5hbCA9IFsgLi4ua2VuZHJhRXh0ZXJuYWxdO1xuICAgIGNvbmZpZy5yYWcuZW1iZWRkaW5nc01vZGVscyA9IGVtYmVkZGluZ01vZGVscztcbiAgICBjb25maWcucmFnLmVtYmVkZGluZ3NNb2RlbHMuZm9yRWFjaCgobTogYW55KSA9PiB7IGlmIChtLm5hbWUgPT09IG1vZGVscy5kZWZhdWx0RW1iZWRkaW5nKSB7IG0uZGVmYXVsdCA9IHRydWUgfSB9KVxuICAgIGNvbnNvbGUubG9nKFwiXFxu4pyoIFRoaXMgaXMgdGhlIGNob3NlbiBjb25maWd1cmF0aW9uOlxcblwiKVxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGNvbmZpZywgdW5kZWZpbmVkLCAyKSk7XG4gICAgKChhd2FpdCBlbnF1aXJlci5wcm9tcHQoW3tcbiAgICAgICAgdHlwZTogXCJjb25maXJtXCIsXG4gICAgICAgIG5hbWU6IFwiY3JlYXRlXCIsXG4gICAgICAgIG1lc3NhZ2U6IFwiRG8geW91IHdhbnQgdG8gY3JlYXRlIGEgbmV3IGNvbmZpZyBiYXNlZCBvbiB0aGUgYWJvdmVcIixcbiAgICAgICAgaW5pdGlhbDogZmFsc2VcbiAgICB9XSkpIGFzIGFueSkuY3JlYXRlID8gY3JlYXRlQ29uZmlnKGNvbmZpZykgOiBjb25zb2xlLmxvZyhcIlNraXBwaW5nXCIpO1xufSJdfQ==