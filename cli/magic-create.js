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
            options.llms = config.llms;
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
            name: 'llms',
            message: 'Which other LLMs do you want to enable',
            choices: Object.values(types_1.SupportedLLM),
            initial: options.llms || []
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
        llms: answers.llms,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFnaWMtY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFnaWMtY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsNkJBQTZCO0FBQzdCLCtCQUErQjs7QUFFL0IseUNBQW9DO0FBQ3BDLHFDQUFxQztBQUNyQywrQ0FBaUY7QUFDakYsNkNBQTJDO0FBQzNDLHlCQUF5QjtBQUd6QixNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUM7QUFFcEMsTUFBTSxlQUFlLEdBQUc7SUFDcEI7UUFDSSxRQUFRLEVBQUUsV0FBVztRQUNyQixJQUFJLEVBQUUsZ0NBQWdDO1FBQ3RDLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsV0FBVztRQUNyQixJQUFJLEVBQUUsd0NBQXdDO1FBQzlDLFVBQVUsRUFBRSxHQUFHO0tBQ2hCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsU0FBUztRQUNuQixJQUFJLEVBQUUseUJBQXlCO1FBQy9CLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsUUFBUTtRQUNsQixJQUFJLEVBQUUsd0JBQXdCO1FBQzlCLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0NBQ04sQ0FBQztBQUVGOztHQUVHO0FBRUgsQ0FBQyxLQUFLLElBQUksRUFBRTtJQUNSLElBQUksT0FBTyxHQUFHLElBQUksbUJBQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQy9FLE9BQU8sQ0FBQyxPQUFPLENBQUMsd0JBQVcsQ0FBQyxDQUFDO0lBRTdCLE9BQU87U0FDRixNQUFNLENBQUMsdUJBQXVCLEVBQUUsMEJBQTBCLENBQUMsQ0FBQTtJQUVoRSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUMsRUFBRTtRQUM1QixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUNwQyxNQUFNLE1BQU0sR0FBaUIsSUFBSSxDQUFDLEtBQUss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LElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7UUFBRSxDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQTtLQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFDakgsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFBO0lBQ3RELE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakQsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyQixJQUFJLEVBQUUsU0FBUztZQUNmLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLHVEQUF1RDtZQUNoRSxPQUFPLEVBQUUsS0FBSztTQUNqQixDQUFDLENBQUMsQ0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3pFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5cbi8vIENvcHlyaWdodCAyMDIxIEFtYXpvbi5jb20uXG4vLyBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogTUlUXG5cbmltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjb21tYW5kZXInO1xuaW1wb3J0ICogYXMgZW5xdWlyZXIgZnJvbSAnZW5xdWlyZXInO1xuaW1wb3J0IHsgU3VwcG9ydGVkUmVnaW9uLCBTdXBwb3J0ZWRMTE0sIFN5c3RlbUNvbmZpZ30gZnJvbSAnLi4vbGliL3NoYXJlZC90eXBlcyc7XG5pbXBvcnQgeyBMSUJfVkVSU0lPTiB9IGZyb20gJy4vdmVyc2lvbi5qcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5cblxuY29uc3QgdmVyc2lvblJlZ0V4cCA9IC9cXGQrLlxcZCsuXFxkKy87XG5cbmNvbnN0IGVtYmVkZGluZ01vZGVscyA9IFtcbiAgICB7XG4gICAgICAgIHByb3ZpZGVyOiBcInNhZ2VtYWtlclwiLFxuICAgICAgICBuYW1lOiBcImludGZsb2F0L211bHRpbGluZ3VhbC1lNS1sYXJnZVwiLFxuICAgICAgICBkaW1lbnNpb25zOiAxMDI0LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwic2FnZW1ha2VyXCIsXG4gICAgICAgIG5hbWU6IFwic2VudGVuY2UtdHJhbnNmb3JtZXJzL2FsbC1NaW5pTE0tTDYtdjJcIixcbiAgICAgICAgZGltZW5zaW9uczogMzg0LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwiYmVkcm9ja1wiLFxuICAgICAgICBuYW1lOiBcImFtYXpvbi50aXRhbi1lMXQtbWVkaXVtXCIsXG4gICAgICAgIGRpbWVuc2lvbnM6IDQwOTYsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBwcm92aWRlcjogXCJvcGVuYWlcIixcbiAgICAgICAgbmFtZTogXCJ0ZXh0LWVtYmVkZGluZy1hZGEtMDAyXCIsXG4gICAgICAgIGRpbWVuc2lvbnM6IDE1MzYsXG4gICAgICB9LFxuXTtcblxuLyoqXG4gKiBNYWluIGVudHJ5IHBvaW50XG4gKi9cblxuKGFzeW5jICgpID0+eyBcbiAgICBsZXQgcHJvZ3JhbSA9IG5ldyBDb21tYW5kKCkuZGVzY3JpcHRpb24oJ0NyZWF0ZXMgYSBuZXcgY2hhdGJvdCBjb25maWd1cmF0aW9uJyk7XG4gICAgcHJvZ3JhbS52ZXJzaW9uKExJQl9WRVJTSU9OKTtcbiAgICBcbiAgICBwcm9ncmFtXG4gICAgICAgIC5vcHRpb24oJy1wLCAtLXByZWZpeCA8cHJlZml4PicsICdUaGUgcHJlZml4IGZvciB0aGUgc3RhY2snKVxuXG4gICAgcHJvZ3JhbS5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpPT4geyBcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoXCIuL2Jpbi9jb25maWcuanNvblwiKSkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnOiBTeXN0ZW1Db25maWcgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhcIi4vYmluL2NvbmZpZy5qc29uXCIpLnRvU3RyaW5nKFwidXRmOFwiKSk7XG4gICAgICAgICAgICBvcHRpb25zLnByZWZpeCA9IGNvbmZpZy5wcmVmaXg7XG4gICAgICAgICAgICBvcHRpb25zLmJlZHJvY2tFbmFibGUgPSBjb25maWcuYmVkcm9jaz8uZW5hYmxlZDtcbiAgICAgICAgICAgIG9wdGlvbnMuYmVkcm9ja1JlZ2lvbiA9IGNvbmZpZy5iZWRyb2NrPy5yZWdpb247XG4gICAgICAgICAgICBvcHRpb25zLmJlZHJvY2tFbmRwb2ludCA9IGNvbmZpZy5iZWRyb2NrPy5lbmRwb2ludFVybDtcbiAgICAgICAgICAgIG9wdGlvbnMuYmVkcm9ja1JvbGVBcm4gPSBjb25maWcuYmVkcm9jaz8ucm9sZUFybjtcbiAgICAgICAgICAgIG9wdGlvbnMubGxtcyA9IGNvbmZpZy5sbG1zO1xuICAgICAgICAgICAgb3B0aW9ucy5yYWdzVG9FbmFibGUgPSBPYmplY3Qua2V5cyhjb25maWcucmFnLmVuZ2luZXMpLmZpbHRlcigodjpzdHJpbmcpID0+IChjb25maWcucmFnLmVuZ2luZXMgYXMgYW55KVt2XS5lbmFibGVkKVxuICAgICAgICAgICAgb3B0aW9ucy5lbWJlZGRpbmdzID0gY29uZmlnLnJhZy5lbWJlZGRpbmdzTW9kZWxzLm1hcCgobTphbnkpID0+IG0ubmFtZSk7XG4gICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRFbWJlZGRpbmcgPSBjb25maWcucmFnLmVtYmVkZGluZ3NNb2RlbHMuZmlsdGVyKChtOiBhbnkpID0+IG0uZGVmYXVsdClbMF0ubmFtZTtcbiAgICAgICAgICAgIG9wdGlvbnMua2VuZHJhRXh0ZXJuYWwgPSBjb25maWcucmFnLmVuZ2luZXMua2VuZHJhLmV4dGVybmFsO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBwcm9jZXNzQ3JlYXRlT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJDb3VsZCBub3QgY29tcGxldGUgdGhlIG9wZXJhdGlvbi5cIik7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICB9XG4gICAgfSlcblxuICAgIHByb2dyYW0ucGFyc2UocHJvY2Vzcy5hcmd2KTtcbn0gKSgpO1xuXG5mdW5jdGlvbiBjcmVhdGVDb25maWcoY29uZmlnOiBhbnkpOiB2b2lkIHtcbiAgICBmcy53cml0ZUZpbGVTeW5jKFwiLi9iaW4vY29uZmlnLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkoY29uZmlnLCB1bmRlZmluZWQsIDIpKTtcbiAgICBjb25zb2xlLmxvZyhcIk5ldyBjb25maWcgd3JpdHRlbiB0byAuL2Jpbi9jb25maWcuanNvblwiKVxufVxuXG4vKipcbiAqIFByb21wdHMgdGhlIHVzZXIgZm9yIG1pc3Npbmcgb3B0aW9uc1xuICogXG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHByb3ZpZGVkIHZpYSB0aGUgQ0xJXG4gKiBAcmV0dXJucyBUaGUgY29tcGxldGUgb3B0aW9uc1xuICovXG5hc3luYyBmdW5jdGlvbiBwcm9jZXNzQ3JlYXRlT3B0aW9ucyhvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsZXQgcXVlc3Rpb25zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnaW5wdXQnLFxuICAgICAgICAgICAgbmFtZTogJ3ByZWZpeCcsXG4gICAgICAgICAgICBtZXNzYWdlOiAnUHJlZml4IHRvIGRpZmZlcmVudGlhdGUgdGhpcyBkZXBsb3ltZW50JyxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMucHJlZml4LFxuICAgICAgICAgICAgYXNrQW5zd2VyZWQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnY29uZmlybScsXG4gICAgICAgICAgICBuYW1lOiAnYmVkcm9ja0VuYWJsZScsXG4gICAgICAgICAgICBtZXNzYWdlOiAnRG8geW91IGhhdmUgYWNjZXNzIHRvIEJlZHJvY2sgYW5kIHdhbnQgdG8gZW5hYmxlIGl0JyxcbiAgICAgICAgICAgIGluaXRpYWw6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICBuYW1lOiAnYmVkcm9ja1JlZ2lvbicsXG4gICAgICAgICAgICBtZXNzYWdlOiAnUmVnaW9uIHdoZXJlIEJlZHJvY2sgaXMgYXZhaWxhYmxlJyxcbiAgICAgICAgICAgIGNob2ljZXM6IFtTdXBwb3J0ZWRSZWdpb24uVVNfRUFTVF8xICwgU3VwcG9ydGVkUmVnaW9uLlVTX1dFU1RfMiwgU3VwcG9ydGVkUmVnaW9uLkVVX0NFTlRSQUxfMSwgU3VwcG9ydGVkUmVnaW9uLkFQX1NPVVRIRUFTVF8xIF0sXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLmJlZHJvY2tSZWdpb24gPz8gJ3VzLWVhc3QtMScsXG4gICAgICAgICAgICBza2lwKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhKHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmJlZHJvY2tFbmFibGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2lucHV0JyxcbiAgICAgICAgICAgIG5hbWU6ICdiZWRyb2NrRW5kcG9pbnQnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0JlZHJvY2sgZW5kcG9pbnQgLSBsZWF2ZSBhcyBpcyBmb3Igc3RhbmRhcmQgZW5kcG9pbnQnLFxuICAgICAgICAgICAgaW5pdGlhbCgpIHsgcmV0dXJuICBgaHR0cHM6Ly9iZWRyb2NrLiR7KHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmJlZHJvY2tSZWdpb259LmFtYXpvbmF3cy5jb21gfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnaW5wdXQnLFxuICAgICAgICAgICAgbmFtZTogJ2JlZHJvY2tSb2xlQXJuJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdDcm9zcyBhY2NvdW50IHJvbGUgYXJuIHRvIGludm9rZSBCZWRyb2NrIC0gbGVhdmUgZW1wdHkgaWYgQmVkcm9jayBpcyBpbiBzYW1lIGFjY291bnQnLFxuICAgICAgICAgICAgdmFsaWRhdGU6ICh2OiBzdHJpbmcpID0+IHsgXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsaWQgPSBSZWdFeHAoL2Fybjphd3M6aWFtOjpcXGQrOnJvbGVcXC9bXFx3LV9dKy8pLnRlc3Qodik7XG4gICAgICAgICAgICAgICAgcmV0dXJuICh2Lmxlbmd0aCA9PT0gMCkgfHwgdmFsaWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbDogb3B0aW9ucy5iZWRyb2NrUm9sZUFybiB8fCAnJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbXVsdGlzZWxlY3QnLFxuICAgICAgICAgICAgbmFtZTogJ2xsbXMnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1doaWNoIG90aGVyIExMTXMgZG8geW91IHdhbnQgdG8gZW5hYmxlJyxcbiAgICAgICAgICAgIGNob2ljZXM6IE9iamVjdC52YWx1ZXMoU3VwcG9ydGVkTExNKSxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMubGxtcyB8fCBbXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnY29uZmlybScsXG4gICAgICAgICAgICBuYW1lOiAnZW5hYmxlUmFnJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBlbmFibGUgUkFHJyxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMuZW5hYmxlUmFnIHx8IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJtdWx0aXNlbGVjdFwiLFxuICAgICAgICAgICAgbmFtZTogXCJyYWdzVG9FbmFibGVcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdXaGljaCBkYXRhc3RvcmVzIGRvIHlvdSB3YW50IHRvIGVuYWJsZSBmb3IgUkFHJyxcbiAgICAgICAgICAgIGNob2ljZXM6IFsgXG4gICAgICAgICAgICAgICAge21lc3NhZ2U6J0F1cm9yYScsIG5hbWU6J2F1cm9yYSd9LCBcbiAgICAgICAgICAgICAgICAvLyBOb3QgeWV0IHN1cHBvcnRlZFxuICAgICAgICAgICAgICAgIC8vIHttZXNzYWdlOidPcGVuU2VhcmNoJywgbmFtZTonb3BlbnNlYXJjaCd9LCBcbiAgICAgICAgICAgICAgICAvLyB7bWVzc2FnZTonS2VuZHJhIChtYW5hZ2VkKScsIG5hbWU6J2tlbmRyYSd9LCBcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBza2lwOiBmdW5jdGlvbiAoKTpib29sZWFuIHtcbiAgICAgICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vZW5xdWlyZXIvZW5xdWlyZXIvaXNzdWVzLzI5OFxuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuc3RhdGUuX2Nob2ljZXMgPSAodGhpcyBhcyBhbnkpLnN0YXRlLmNob2ljZXM7XG4gICAgICAgICAgICAgICAgcmV0dXJuICEodGhpcyBhcyBhbnkpLnN0YXRlLmFuc3dlcnMuZW5hYmxlUmFnO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMucmFnc1RvRW5hYmxlIHx8IFtdXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6IFwiY29uZmlybVwiLFxuICAgICAgICAgICAgbmFtZTogXCJrZW5kcmFcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IFwiRG8geW91IHdhbnQgdG8gYWRkIGV4aXN0aW5nIEtlbmRyYSBpbmRleGVzXCIsXG4gICAgICAgICAgICBpbml0aWFsOiAhIW9wdGlvbnMua2VuZHJhRXh0ZXJuYWwgfHwgZmFsc2UsXG4gICAgICAgICAgICBza2lwOiBmdW5jdGlvbiAoKTpib29sZWFuIHsgXG4gICAgICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2VucXVpcmVyL2VucXVpcmVyL2lzc3Vlcy8yOThcbiAgICAgICAgICAgICAgICAodGhpcyBhcyBhbnkpLnN0YXRlLl9jaG9pY2VzID0gKHRoaXMgYXMgYW55KS5zdGF0ZS5jaG9pY2VzO1xuICAgICAgICAgICAgICAgIHJldHVybiAhKHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmVuYWJsZVJhZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICBdXG4gICAgY29uc3QgYW5zd2VyczphbnkgPSBhd2FpdCBlbnF1aXJlci5wcm9tcHQocXVlc3Rpb25zKTtcbiAgICBjb25zdCBrZW5kcmFFeHRlcm5hbCA9IFtdXG4gICAgbGV0IG5ld0tlbmRyYSA9IGFuc3dlcnMuZW5hYmxlUmFnICYmIGFuc3dlcnMua2VuZHJhXG5cbiAgICAvLyBpZiAob3B0aW9ucy5rZW5kcmFFeHRlcm5hbCkge1xuICAgIC8vICAgICBvcHRpb25zLmtlbmRyYUV4dGVybmFsLmZvckVhY2goKHY6IGFueSkgPT4gY29uc29sZS5sb2codikpXG4gICAgLy8gfVxuICAgIHdoaWxlIChuZXdLZW5kcmEgPT09IHRydWUpIHtcbiAgICAgICAgY29uc3Qga2VuZHJhUSA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImlucHV0XCIsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJuYW1lXCIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJLZW5kcmEgc291cmNlIG5hbWVcIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImF1dG9jb21wbGV0ZVwiLFxuICAgICAgICAgICAgICAgIGxpbWl0OjgsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJyZWdpb25cIixcbiAgICAgICAgICAgICAgICBjaG9pY2VzOiBPYmplY3QudmFsdWVzKFN1cHBvcnRlZFJlZ2lvbiksXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJSZWdpb24gb2YgdGhlIEtlbmRyYSBpbmRleFwiXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiaW5wdXRcIixcbiAgICAgICAgICAgICAgICBuYW1lOiBcInJvbGVBcm5cIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIkNyb3NzIGFjY291bnQgcm9sZSBBcm4gdG8gYXNzdW1lIHRvIGNhbGwgS2VuZHJhLCBsZWF2ZSBlbXB0eSBpZiBub3QgbmVlZGVkXCIsXG4gICAgICAgICAgICAgICAgdmFsaWRhdGU6ICh2OiBzdHJpbmcpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkID0gUmVnRXhwKC9hcm46YXdzOmlhbTo6XFxkKzpyb2xlXFwvW1xcdy1fXSsvKS50ZXN0KHYpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKHYubGVuZ3RoID09PSAwKSB8fCB2YWxpZDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGluaXRpYWw6IFwiXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJpbnB1dFwiLFxuICAgICAgICAgICAgICAgIG5hbWU6IFwia2VuZHJhSWRcIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIktlbmRyYSBJRFwiLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRlKHY6IHN0cmluZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUmVnRXhwKC9cXHd7OH0tXFx3ezR9LVxcd3s0fS1cXHd7NH0tXFx3ezEyfS8pLnRlc3QodilcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJjb25maXJtXCIsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJuZXdLZW5kcmFcIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIkRvIHlvdSB3YW50IHRvIGFkZCBhbm90aGVyIEtlbmRyYSBzb3VyY2VcIixcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgICBjb25zdCBrZW5kcmFJbnN0YW5jZTphbnkgPSBhd2FpdCBlbnF1aXJlci5wcm9tcHQoa2VuZHJhUSk7XG4gICAgICAgIGNvbnN0IGV4dCA9ICgoe25hbWUsIHJvbGVBcm4sIGtlbmRyYUlkLCByZWdpb259KSA9PiAoe25hbWUsIHJvbGVBcm4sIGtlbmRyYUlkLCByZWdpb259KSkoa2VuZHJhSW5zdGFuY2UpXG4gICAgICAgIGlmIChleHQucm9sZUFybiA9PT0gJycpIGV4dC5yb2xlQXJuID0gdW5kZWZpbmVkO1xuICAgICAgICBrZW5kcmFFeHRlcm5hbC5wdXNoKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBleHRlcm5hbDogZXh0XG4gICAgICAgIH0pXG4gICAgICAgIG5ld0tlbmRyYSA9IGtlbmRyYUluc3RhbmNlLm5ld0tlbmRyYVxuICAgIH1cbiAgICBjb25zdCBtb2RlbHNQcm9tcHRzID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0RW1iZWRkaW5nJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdXaGljaCBpcyB0aGUgZGVmYXVsdCBlbWJlZGRpbmcgbW9kZWwnLFxuICAgICAgICAgICAgY2hvaWNlczogZW1iZWRkaW5nTW9kZWxzLm1hcChtID0+ICh7bmFtZTogbS5uYW1lLCB2YWx1ZTogbX0pKSxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMuZGVmYXVsdEVtYmVkZGluZyB8fCB1bmRlZmluZWRcbiAgICAgICAgfVxuICAgIF1cbiAgICBjb25zdCBtb2RlbHM6IGFueSA9IGF3YWl0IGVucXVpcmVyLnByb21wdChtb2RlbHNQcm9tcHRzKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgY29uZmlnIG9iamVjdFxuICAgIGNvbnN0IGNvbmZpZyA9IHsgXG4gICAgICAgIHByZWZpeDogYW5zd2Vycy5wcmVmaXgsIFxuICAgICAgICBiZWRyb2NrOiAoYW5zd2Vycy5iZWRyb2NrRW5hYmxlID8ge1xuICAgICAgICAgICAgZW5hYmxlZDogYW5zd2Vycy5iZWRyb2NrRW5hYmxlLFxuICAgICAgICAgICAgcmVnaW9uOiBhbnN3ZXJzLmJlZHJvY2tSZWdpb24sXG4gICAgICAgICAgICByb2xlQXJuOiBhbnN3ZXJzLmJlZHJvY2tSb2xlQXJuID09PSAnJyA/IHVuZGVmaW5lZCA6IGFuc3dlcnMuYmVkcm9ja1JvbGVBcm4sXG4gICAgICAgICAgICBlbmRwb2ludFVybDogYW5zd2Vycy5iZWRyb2NrRW5kcG9pbnRcbiAgICAgICAgfSA6IHVuZGVmaW5lZCksXG4gICAgICAgIGxsbXM6IGFuc3dlcnMubGxtcyxcbiAgICAgICAgcmFnOiB7XG4gICAgICAgICAgICBlbmFibGVkOiBhbnN3ZXJzLmVuYWJsZVJhZyxcbiAgICAgICAgICAgIGVuZ2luZXM6IHtcbiAgICAgICAgICAgICAgICBhdXJvcmE6IHtcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogYW5zd2Vycy5yYWdzVG9FbmFibGUuaW5jbHVkZXMoJ2F1cm9yYScpXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBvcGVuc2VhcmNoOiB7XG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGFuc3dlcnMucmFnc1RvRW5hYmxlLmluY2x1ZGVzKCdvcGVuc2VhcmNoJylcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGtlbmRyYTogeyBlbmFibGVkOiBmYWxzZSwgZXh0ZXJuYWw6IFt7fV0gfSxcblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVtYmVkZGluZ3NNb2RlbHM6IFsge30gXSxcbiAgICAgICAgICAgIGNyb3NzRW5jb2Rlck1vZGVsczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXI6IFwic2FnZW1ha2VyXCIsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiY3Jvc3MtZW5jb2Rlci9tcy1tYXJjby1NaW5pTE0tTC0xMi12MlwiLFxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcbiAgICAgICAgXG4gICAgICAgIFxuICAgICAgICBcbiAgICB9XG4gICAgY29uZmlnLnJhZy5lbmdpbmVzLmtlbmRyYS5lbmFibGVkID0gYW5zd2Vycy5yYWdzVG9FbmFibGUuaW5jbHVkZXMoJ2tlbmRyYScpO1xuICAgIGNvbmZpZy5yYWcuZW5naW5lcy5rZW5kcmEuZXh0ZXJuYWwgPSBbIC4uLmtlbmRyYUV4dGVybmFsXTtcbiAgICBjb25maWcucmFnLmVtYmVkZGluZ3NNb2RlbHMgPSBlbWJlZGRpbmdNb2RlbHM7XG4gICAgY29uZmlnLnJhZy5lbWJlZGRpbmdzTW9kZWxzLmZvckVhY2goKG06IGFueSkgPT4geyBpZiAobS5uYW1lID09PSBtb2RlbHMuZGVmYXVsdEVtYmVkZGluZykgeyBtLmRlZmF1bHQgPSB0cnVlIH0gfSlcbiAgICBjb25zb2xlLmxvZyhcIlxcbuKcqCBUaGlzIGlzIHRoZSBjaG9zZW4gY29uZmlndXJhdGlvbjpcXG5cIilcbiAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShjb25maWcsIHVuZGVmaW5lZCwgMikpO1xuICAgICgoYXdhaXQgZW5xdWlyZXIucHJvbXB0KFt7XG4gICAgICAgIHR5cGU6IFwiY29uZmlybVwiLFxuICAgICAgICBuYW1lOiBcImNyZWF0ZVwiLFxuICAgICAgICBtZXNzYWdlOiBcIkRvIHlvdSB3YW50IHRvIGNyZWF0ZSBhIG5ldyBjb25maWcgYmFzZWQgb24gdGhlIGFib3ZlXCIsXG4gICAgICAgIGluaXRpYWw6IGZhbHNlXG4gICAgfV0pKSBhcyBhbnkpLmNyZWF0ZSA/IGNyZWF0ZUNvbmZpZyhjb25maWcpIDogY29uc29sZS5sb2coXCJTa2lwcGluZ1wiKTtcbn0iXX0=