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
        if (fs.existsSync("config.json")) {
            const config = JSON.parse(fs.readFileSync("config.json").toString("utf8"));
            options.prefix = config.prefix;
            options.bedrockEnable = !!config.bedrock;
            options.bedrockRegion = config.bedrock.region;
            options.bedrockEndpoint = config.bedrock.endpointUrl;
            options.bedrockRoleArn = config.bedrock.roleArn;
            options.llms = config.llms;
            options.ragsToEnable = Object.keys(config.rag.engines).filter(v => config.rag.engines[v].enabled);
            options.embeddings = config.embeddingModels.map((m) => m.name);
            options.defaultEmbedding = config.embeddingModels.filter((m) => m.default)[0].name;
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
    fs.writeFileSync("config.json", JSON.stringify(config, undefined, 2));
    console.log("New config written to config.json");
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
            initial: 'us-east-1',
            skip() {
                return !this.state.answers.bedrockEnable;
            }
        },
        {
            type: 'input',
            name: 'bedrockEndpoint',
            message: 'Bedrock endpoint - leave as is for standard endpoint',
            initial() { return options.bedrockEndpoint || `https://bedrock.${this.state.answers.bedrockRegion}.amazonaws.com`; }
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
            }
        },
        embeddingModels: [{}],
        crossEncoderModels: [
            {
                provider: "sagemaker",
                name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
                default: true,
            }
        ]
    };
    config.rag.engines.kendra.enabled = answers.ragsToEnable.includes('kendra');
    config.rag.engines.kendra.external = [...kendraExternal];
    config.embeddingModels = embeddingModels;
    config.embeddingModels.forEach((m) => { if (m.name === models.defaultEmbedding) {
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
    return;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFnaWMtY3JlYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFnaWMtY3JlYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsNkJBQTZCO0FBQzdCLCtCQUErQjs7QUFFL0IseUNBQW9DO0FBQ3BDLHFDQUFxQztBQUNyQywrQ0FBbUU7QUFDbkUsNkNBQTJDO0FBQzNDLHlCQUF5QjtBQUd6QixNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUM7QUFFcEMsTUFBTSxlQUFlLEdBQUc7SUFDcEI7UUFDSSxRQUFRLEVBQUUsV0FBVztRQUNyQixJQUFJLEVBQUUsZ0NBQWdDO1FBQ3RDLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsV0FBVztRQUNyQixJQUFJLEVBQUUsd0NBQXdDO1FBQzlDLFVBQVUsRUFBRSxHQUFHO0tBQ2hCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsU0FBUztRQUNuQixJQUFJLEVBQUUseUJBQXlCO1FBQy9CLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0lBQ0Q7UUFDRSxRQUFRLEVBQUUsUUFBUTtRQUNsQixJQUFJLEVBQUUsd0JBQXdCO1FBQzlCLFVBQVUsRUFBRSxJQUFJO0tBQ2pCO0NBQ04sQ0FBQztBQUVGOztHQUVHO0FBRUgsQ0FBQyxLQUFLLElBQUksRUFBRTtJQUNSLElBQUksT0FBTyxHQUFHLElBQUksbUJBQU8sRUFBRSxDQUFDLFdBQVcsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO0lBQy9FLE9BQU8sQ0FBQyxPQUFPLENBQUMsd0JBQVcsQ0FBQyxDQUFDO0lBRTdCLE9BQU87U0FDRixNQUFNLENBQUMsdUJBQXVCLEVBQUUsMEJBQTBCLENBQUMsQ0FBQTtJQUVoRSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUMsRUFBRTtRQUM1QixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDOUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FB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QUMsQ0FBQyxDQUFBO0lBQzVHLE9BQU8sQ0FBQyxHQUFHLENBQUMseUNBQXlDLENBQUMsQ0FBQTtJQUN0RCxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUMsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDckIsSUFBSSxFQUFFLFNBQVM7WUFDZixJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSx1REFBdUQ7WUFDaEUsT0FBTyxFQUFFLEtBQUs7U0FDakIsQ0FBQyxDQUFDLENBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNyRSxPQUFPO0FBQ1gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcblxuLy8gQ29weXJpZ2h0IDIwMjEgQW1hem9uLmNvbS5cbi8vIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBNSVRcblxuaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NvbW1hbmRlcic7XG5pbXBvcnQgKiBhcyBlbnF1aXJlciBmcm9tICdlbnF1aXJlcic7XG5pbXBvcnQgeyBTdXBwb3J0ZWRSZWdpb24sIFN1cHBvcnRlZExMTX0gZnJvbSAnLi4vbGliL3NoYXJlZC90eXBlcyc7XG5pbXBvcnQgeyBMSUJfVkVSU0lPTiB9IGZyb20gJy4vdmVyc2lvbi5qcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5cblxuY29uc3QgdmVyc2lvblJlZ0V4cCA9IC9cXGQrLlxcZCsuXFxkKy87XG5cbmNvbnN0IGVtYmVkZGluZ01vZGVscyA9IFtcbiAgICB7XG4gICAgICAgIHByb3ZpZGVyOiBcInNhZ2VtYWtlclwiLFxuICAgICAgICBuYW1lOiBcImludGZsb2F0L211bHRpbGluZ3VhbC1lNS1sYXJnZVwiLFxuICAgICAgICBkaW1lbnNpb25zOiAxMDI0LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwic2FnZW1ha2VyXCIsXG4gICAgICAgIG5hbWU6IFwic2VudGVuY2UtdHJhbnNmb3JtZXJzL2FsbC1NaW5pTE0tTDYtdjJcIixcbiAgICAgICAgZGltZW5zaW9uczogMzg0LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwiYmVkcm9ja1wiLFxuICAgICAgICBuYW1lOiBcImFtYXpvbi50aXRhbi1lMXQtbWVkaXVtXCIsXG4gICAgICAgIGRpbWVuc2lvbnM6IDQwOTYsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBwcm92aWRlcjogXCJvcGVuYWlcIixcbiAgICAgICAgbmFtZTogXCJ0ZXh0LWVtYmVkZGluZy1hZGEtMDAyXCIsXG4gICAgICAgIGRpbWVuc2lvbnM6IDE1MzYsXG4gICAgICB9LFxuXTtcblxuLyoqXG4gKiBNYWluIGVudHJ5IHBvaW50XG4gKi9cblxuKGFzeW5jICgpID0+eyBcbiAgICBsZXQgcHJvZ3JhbSA9IG5ldyBDb21tYW5kKCkuZGVzY3JpcHRpb24oJ0NyZWF0ZXMgYSBuZXcgY2hhdGJvdCBjb25maWd1cmF0aW9uJyk7XG4gICAgcHJvZ3JhbS52ZXJzaW9uKExJQl9WRVJTSU9OKTtcbiAgICBcbiAgICBwcm9ncmFtXG4gICAgICAgIC5vcHRpb24oJy1wLCAtLXByZWZpeCA8cHJlZml4PicsICdUaGUgcHJlZml4IGZvciB0aGUgc3RhY2snKVxuXG4gICAgcHJvZ3JhbS5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpPT4geyBcbiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoXCJjb25maWcuanNvblwiKSkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoXCJjb25maWcuanNvblwiKS50b1N0cmluZyhcInV0ZjhcIikpO1xuICAgICAgICAgICAgb3B0aW9ucy5wcmVmaXggPSBjb25maWcucHJlZml4O1xuICAgICAgICAgICAgb3B0aW9ucy5iZWRyb2NrRW5hYmxlID0gISFjb25maWcuYmVkcm9ja1xuICAgICAgICAgICAgb3B0aW9ucy5iZWRyb2NrUmVnaW9uID0gY29uZmlnLmJlZHJvY2sucmVnaW9uO1xuICAgICAgICAgICAgb3B0aW9ucy5iZWRyb2NrRW5kcG9pbnQgPSBjb25maWcuYmVkcm9jay5lbmRwb2ludFVybDtcbiAgICAgICAgICAgIG9wdGlvbnMuYmVkcm9ja1JvbGVBcm4gPSBjb25maWcuYmVkcm9jay5yb2xlQXJuO1xuICAgICAgICAgICAgb3B0aW9ucy5sbG1zID0gY29uZmlnLmxsbXM7XG4gICAgICAgICAgICBvcHRpb25zLnJhZ3NUb0VuYWJsZSA9IE9iamVjdC5rZXlzKGNvbmZpZy5yYWcuZW5naW5lcykuZmlsdGVyKHYgPT4gY29uZmlnLnJhZy5lbmdpbmVzW3ZdLmVuYWJsZWQpXG4gICAgICAgICAgICBvcHRpb25zLmVtYmVkZGluZ3MgPSBjb25maWcuZW1iZWRkaW5nTW9kZWxzLm1hcCgobTphbnkpID0+IG0ubmFtZSk7XG4gICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRFbWJlZGRpbmcgPSBjb25maWcuZW1iZWRkaW5nTW9kZWxzLmZpbHRlcigobTogYW55KSA9PiBtLmRlZmF1bHQpWzBdLm5hbWU7XG4gICAgICAgICAgICBvcHRpb25zLmtlbmRyYUV4dGVybmFsID0gY29uZmlnLnJhZy5lbmdpbmVzLmtlbmRyYS5leHRlcm5hbDtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgcHJvY2Vzc0NyZWF0ZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiQ291bGQgbm90IGNvbXBsZXRlIHRoZSBvcGVyYXRpb24uXCIpO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICBwcm9ncmFtLnBhcnNlKHByb2Nlc3MuYXJndik7XG59ICkoKTtcblxuZnVuY3Rpb24gY3JlYXRlQ29uZmlnKGNvbmZpZzogYW55KTogdm9pZCB7XG4gICAgZnMud3JpdGVGaWxlU3luYyhcImNvbmZpZy5qc29uXCIsIEpTT04uc3RyaW5naWZ5KGNvbmZpZywgdW5kZWZpbmVkLCAyKSk7XG4gICAgY29uc29sZS5sb2coXCJOZXcgY29uZmlnIHdyaXR0ZW4gdG8gY29uZmlnLmpzb25cIilcbn1cblxuLyoqXG4gKiBQcm9tcHRzIHRoZSB1c2VyIGZvciBtaXNzaW5nIG9wdGlvbnNcbiAqIFxuICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyBwcm92aWRlZCB2aWEgdGhlIENMSVxuICogQHJldHVybnMgVGhlIGNvbXBsZXRlIG9wdGlvbnNcbiAqL1xuYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0NyZWF0ZU9wdGlvbnMob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IHF1ZXN0aW9ucyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2lucHV0JyxcbiAgICAgICAgICAgIG5hbWU6ICdwcmVmaXgnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZpeCB0byBkaWZmZXJlbnRpYXRlIHRoaXMgZGVwbG95bWVudCcsXG4gICAgICAgICAgICBpbml0aWFsOiBvcHRpb25zLnByZWZpeCxcbiAgICAgICAgICAgIGFza0Fuc3dlcmVkOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2NvbmZpcm0nLFxuICAgICAgICAgICAgbmFtZTogJ2JlZHJvY2tFbmFibGUnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0RvIHlvdSBoYXZlIGFjY2VzcyB0byBCZWRyb2NrIGFuZCB3YW50IHRvIGVuYWJsZSBpdCcsXG4gICAgICAgICAgICBpbml0aWFsOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgbmFtZTogJ2JlZHJvY2tSZWdpb24nLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1JlZ2lvbiB3aGVyZSBCZWRyb2NrIGlzIGF2YWlsYWJsZScsXG4gICAgICAgICAgICBjaG9pY2VzOiBbU3VwcG9ydGVkUmVnaW9uLlVTX0VBU1RfMSAsIFN1cHBvcnRlZFJlZ2lvbi5VU19XRVNUXzIsIFN1cHBvcnRlZFJlZ2lvbi5FVV9DRU5UUkFMXzEsIFN1cHBvcnRlZFJlZ2lvbi5BUF9TT1VUSEVBU1RfMSBdLFxuICAgICAgICAgICAgaW5pdGlhbDogJ3VzLWVhc3QtMScsXG4gICAgICAgICAgICBza2lwKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhKHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmJlZHJvY2tFbmFibGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2lucHV0JyxcbiAgICAgICAgICAgIG5hbWU6ICdiZWRyb2NrRW5kcG9pbnQnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0JlZHJvY2sgZW5kcG9pbnQgLSBsZWF2ZSBhcyBpcyBmb3Igc3RhbmRhcmQgZW5kcG9pbnQnLFxuICAgICAgICAgICAgaW5pdGlhbCgpIHsgcmV0dXJuICBvcHRpb25zLmJlZHJvY2tFbmRwb2ludCB8fCBgaHR0cHM6Ly9iZWRyb2NrLiR7KHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmJlZHJvY2tSZWdpb259LmFtYXpvbmF3cy5jb21gfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnaW5wdXQnLFxuICAgICAgICAgICAgbmFtZTogJ2JlZHJvY2tSb2xlQXJuJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdDcm9zcyBhY2NvdW50IHJvbGUgYXJuIHRvIGludm9rZSBCZWRyb2NrIC0gbGVhdmUgZW1wdHkgaWYgQmVkcm9jayBpcyBpbiBzYW1lIGFjY291bnQnLFxuICAgICAgICAgICAgdmFsaWRhdGU6ICh2OiBzdHJpbmcpID0+IHsgXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsaWQgPSBSZWdFeHAoL2Fybjphd3M6aWFtOjpcXGQrOnJvbGVcXC9bXFx3LV9dKy8pLnRlc3Qodik7XG4gICAgICAgICAgICAgICAgcmV0dXJuICh2Lmxlbmd0aCA9PT0gMCkgfHwgdmFsaWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5pdGlhbDogb3B0aW9ucy5iZWRyb2NrUm9sZUFybiB8fCAnJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbXVsdGlzZWxlY3QnLFxuICAgICAgICAgICAgbmFtZTogJ2xsbXMnLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1doaWNoIG90aGVyIExMTXMgZG8geW91IHdhbnQgdG8gZW5hYmxlJyxcbiAgICAgICAgICAgIGNob2ljZXM6IE9iamVjdC52YWx1ZXMoU3VwcG9ydGVkTExNKSxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMubGxtcyB8fCBbXVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnY29uZmlybScsXG4gICAgICAgICAgICBuYW1lOiAnZW5hYmxlUmFnJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdEbyB5b3Ugd2FudCB0byBlbmFibGUgUkFHJyxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMuZW5hYmxlUmFnIHx8IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJtdWx0aXNlbGVjdFwiLFxuICAgICAgICAgICAgbmFtZTogXCJyYWdzVG9FbmFibGVcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdXaGljaCBkYXRhc3RvcmVzIGRvIHlvdSB3YW50IHRvIGVuYWJsZSBmb3IgUkFHJyxcbiAgICAgICAgICAgIGNob2ljZXM6IFsgXG4gICAgICAgICAgICAgICAge21lc3NhZ2U6J0F1cm9yYScsIG5hbWU6J2F1cm9yYSd9LCBcbiAgICAgICAgICAgICAgICAvLyBOb3QgeWV0IHN1cHBvcnRlZFxuICAgICAgICAgICAgICAgIC8vIHttZXNzYWdlOidPcGVuU2VhcmNoJywgbmFtZTonb3BlbnNlYXJjaCd9LCBcbiAgICAgICAgICAgICAgICAvLyB7bWVzc2FnZTonS2VuZHJhIChtYW5hZ2VkKScsIG5hbWU6J2tlbmRyYSd9LCBcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBza2lwOiBmdW5jdGlvbiAoKTpib29sZWFuIHtcbiAgICAgICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vZW5xdWlyZXIvZW5xdWlyZXIvaXNzdWVzLzI5OFxuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuc3RhdGUuX2Nob2ljZXMgPSAodGhpcyBhcyBhbnkpLnN0YXRlLmNob2ljZXM7XG4gICAgICAgICAgICAgICAgcmV0dXJuICEodGhpcyBhcyBhbnkpLnN0YXRlLmFuc3dlcnMuZW5hYmxlUmFnO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMucmFnc1RvRW5hYmxlIHx8IFtdXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6IFwiY29uZmlybVwiLFxuICAgICAgICAgICAgbmFtZTogXCJrZW5kcmFcIixcbiAgICAgICAgICAgIG1lc3NhZ2U6IFwiRG8geW91IHdhbnQgdG8gYWRkIGV4aXN0aW5nIEtlbmRyYSBpbmRleGVzXCIsXG4gICAgICAgICAgICBpbml0aWFsOiAhIW9wdGlvbnMua2VuZHJhRXh0ZXJuYWwgfHwgZmFsc2UsXG4gICAgICAgICAgICBza2lwOiBmdW5jdGlvbiAoKTpib29sZWFuIHsgXG4gICAgICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL2VucXVpcmVyL2VucXVpcmVyL2lzc3Vlcy8yOThcbiAgICAgICAgICAgICAgICAodGhpcyBhcyBhbnkpLnN0YXRlLl9jaG9pY2VzID0gKHRoaXMgYXMgYW55KS5zdGF0ZS5jaG9pY2VzO1xuICAgICAgICAgICAgICAgIHJldHVybiAhKHRoaXMgYXMgYW55KS5zdGF0ZS5hbnN3ZXJzLmVuYWJsZVJhZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICBdXG4gICAgY29uc3QgYW5zd2VyczphbnkgPSBhd2FpdCBlbnF1aXJlci5wcm9tcHQocXVlc3Rpb25zKTtcbiAgICBjb25zdCBrZW5kcmFFeHRlcm5hbCA9IFtdXG4gICAgbGV0IG5ld0tlbmRyYSA9IGFuc3dlcnMuZW5hYmxlUmFnICYmIGFuc3dlcnMua2VuZHJhXG5cbiAgICAvLyBpZiAob3B0aW9ucy5rZW5kcmFFeHRlcm5hbCkge1xuICAgIC8vICAgICBvcHRpb25zLmtlbmRyYUV4dGVybmFsLmZvckVhY2goKHY6IGFueSkgPT4gY29uc29sZS5sb2codikpXG4gICAgLy8gfVxuICAgIHdoaWxlIChuZXdLZW5kcmEgPT09IHRydWUpIHtcbiAgICAgICAgY29uc3Qga2VuZHJhUSA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImlucHV0XCIsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJuYW1lXCIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJLZW5kcmEgc291cmNlIG5hbWVcIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImF1dG9jb21wbGV0ZVwiLFxuICAgICAgICAgICAgICAgIGxpbWl0OjgsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJyZWdpb25cIixcbiAgICAgICAgICAgICAgICBjaG9pY2VzOiBPYmplY3QudmFsdWVzKFN1cHBvcnRlZFJlZ2lvbiksXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogXCJSZWdpb24gb2YgdGhlIEtlbmRyYSBpbmRleFwiXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6IFwiaW5wdXRcIixcbiAgICAgICAgICAgICAgICBuYW1lOiBcInJvbGVBcm5cIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIkNyb3NzIGFjY291bnQgcm9sZSBBcm4gdG8gYXNzdW1lIHRvIGNhbGwgS2VuZHJhLCBsZWF2ZSBlbXB0eSBpZiBub3QgbmVlZGVkXCIsXG4gICAgICAgICAgICAgICAgdmFsaWRhdGU6ICh2OiBzdHJpbmcpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkID0gUmVnRXhwKC9hcm46YXdzOmlhbTo6XFxkKzpyb2xlXFwvW1xcdy1fXSsvKS50ZXN0KHYpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKHYubGVuZ3RoID09PSAwKSB8fCB2YWxpZDtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGluaXRpYWw6IFwiXCJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJpbnB1dFwiLFxuICAgICAgICAgICAgICAgIG5hbWU6IFwia2VuZHJhSWRcIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIktlbmRyYSBJRFwiLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRlKHY6IHN0cmluZykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUmVnRXhwKC9cXHd7OH0tXFx3ezR9LVxcd3s0fS1cXHd7NH0tXFx3ezEyfS8pLnRlc3QodilcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJjb25maXJtXCIsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJuZXdLZW5kcmFcIixcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBcIkRvIHlvdSB3YW50IHRvIGFkZCBhbm90aGVyIEtlbmRyYSBzb3VyY2VcIixcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgICBjb25zdCBrZW5kcmFJbnN0YW5jZTphbnkgPSBhd2FpdCBlbnF1aXJlci5wcm9tcHQoa2VuZHJhUSk7XG4gICAgICAgIGNvbnN0IGV4dCA9ICgoe25hbWUsIHJvbGVBcm4sIGtlbmRyYUlkLCByZWdpb259KSA9PiAoe25hbWUsIHJvbGVBcm4sIGtlbmRyYUlkLCByZWdpb259KSkoa2VuZHJhSW5zdGFuY2UpXG4gICAgICAgIGlmIChleHQucm9sZUFybiA9PT0gJycpIGV4dC5yb2xlQXJuID0gdW5kZWZpbmVkO1xuICAgICAgICBrZW5kcmFFeHRlcm5hbC5wdXNoKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBleHRlcm5hbDogZXh0XG4gICAgICAgIH0pXG4gICAgICAgIG5ld0tlbmRyYSA9IGtlbmRyYUluc3RhbmNlLm5ld0tlbmRyYVxuICAgIH1cbiAgICBjb25zdCBtb2RlbHNQcm9tcHRzID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0RW1iZWRkaW5nJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdXaGljaCBpcyB0aGUgZGVmYXVsdCBlbWJlZGRpbmcgbW9kZWwnLFxuICAgICAgICAgICAgY2hvaWNlczogZW1iZWRkaW5nTW9kZWxzLm1hcChtID0+ICh7bmFtZTogbS5uYW1lLCB2YWx1ZTogbX0pKSxcbiAgICAgICAgICAgIGluaXRpYWw6IG9wdGlvbnMuZGVmYXVsdEVtYmVkZGluZyB8fCB1bmRlZmluZWRcbiAgICAgICAgfVxuICAgIF1cbiAgICBjb25zdCBtb2RlbHM6IGFueSA9IGF3YWl0IGVucXVpcmVyLnByb21wdChtb2RlbHNQcm9tcHRzKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgY29uZmlnIG9iamVjdFxuICAgIGNvbnN0IGNvbmZpZyA9IHsgXG4gICAgICAgIHByZWZpeDogYW5zd2Vycy5wcmVmaXgsIFxuICAgICAgICBiZWRyb2NrOiAoYW5zd2Vycy5iZWRyb2NrRW5hYmxlID8ge1xuICAgICAgICAgICAgcmVnaW9uOiBhbnN3ZXJzLmJlZHJvY2tSZWdpb24sXG4gICAgICAgICAgICByb2xlQXJuOiBhbnN3ZXJzLmJlZHJvY2tSb2xlQXJuID09PSAnJyA/IHVuZGVmaW5lZCA6IGFuc3dlcnMuYmVkcm9ja1JvbGVBcm4sXG4gICAgICAgICAgICBlbmRwb2ludFVybDogYW5zd2Vycy5iZWRyb2NrRW5kcG9pbnRcbiAgICAgICAgfSA6IHVuZGVmaW5lZCksXG4gICAgICAgIGxsbXM6IGFuc3dlcnMubGxtcyxcbiAgICAgICAgcmFnOiB7XG4gICAgICAgICAgICBlbmFibGVkOiBhbnN3ZXJzLmVuYWJsZVJhZyxcbiAgICAgICAgICAgIGVuZ2luZXM6IHtcbiAgICAgICAgICAgICAgICBhdXJvcmE6IHtcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogYW5zd2Vycy5yYWdzVG9FbmFibGUuaW5jbHVkZXMoJ2F1cm9yYScpXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBvcGVuc2VhcmNoOiB7XG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGFuc3dlcnMucmFnc1RvRW5hYmxlLmluY2x1ZGVzKCdvcGVuc2VhcmNoJylcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGtlbmRyYTogeyBlbmFibGVkOiBmYWxzZSwgZXh0ZXJuYWw6IFt7fV0gfSxcblxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBcbiAgICAgICAgZW1iZWRkaW5nTW9kZWxzOiBbIHt9IF0sXG4gICAgICAgIGNyb3NzRW5jb2Rlck1vZGVsczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHByb3ZpZGVyOiBcInNhZ2VtYWtlclwiLFxuICAgICAgICAgICAgICAgIG5hbWU6IFwiY3Jvc3MtZW5jb2Rlci9tcy1tYXJjby1NaW5pTE0tTC0xMi12MlwiLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICB9XG4gICAgY29uZmlnLnJhZy5lbmdpbmVzLmtlbmRyYS5lbmFibGVkID0gYW5zd2Vycy5yYWdzVG9FbmFibGUuaW5jbHVkZXMoJ2tlbmRyYScpO1xuICAgIGNvbmZpZy5yYWcuZW5naW5lcy5rZW5kcmEuZXh0ZXJuYWwgPSBbIC4uLmtlbmRyYUV4dGVybmFsXTtcbiAgICBjb25maWcuZW1iZWRkaW5nTW9kZWxzID0gZW1iZWRkaW5nTW9kZWxzO1xuICAgIGNvbmZpZy5lbWJlZGRpbmdNb2RlbHMuZm9yRWFjaCgobTogYW55KSA9PiB7IGlmIChtLm5hbWUgPT09IG1vZGVscy5kZWZhdWx0RW1iZWRkaW5nKSB7IG0uZGVmYXVsdCA9IHRydWUgfSB9KVxuICAgIGNvbnNvbGUubG9nKFwiXFxu4pyoIFRoaXMgaXMgdGhlIGNob3NlbiBjb25maWd1cmF0aW9uOlxcblwiKVxuICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGNvbmZpZywgdW5kZWZpbmVkLCAyKSk7XG4gICAgKChhd2FpdCBlbnF1aXJlci5wcm9tcHQoW3tcbiAgICAgICAgdHlwZTogXCJjb25maXJtXCIsXG4gICAgICAgIG5hbWU6IFwiY3JlYXRlXCIsXG4gICAgICAgIG1lc3NhZ2U6IFwiRG8geW91IHdhbnQgdG8gY3JlYXRlIGEgbmV3IGNvbmZpZyBiYXNlZCBvbiB0aGUgYWJvdmVcIixcbiAgICAgICAgaW5pdGlhbDogZmFsc2VcbiAgICB9XSkpIGFzIGFueSkuY3JlYXRlID8gY3JlYXRlQ29uZmlnKGNvbmZpZykgOiBjb25zb2xlLmxvZyhcIlNraXBwaW5nXCIpO1xuICAgIHJldHVybjtcbn0iXX0=