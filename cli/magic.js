#!/usr/bin/env node 
"use strict";
// You might want to add this to the previous line --experimental-specifier-resolution=node
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const version_js_1 = require("./version.js");
(async () => {
    let program = new commander_1.Command();
    program
        .version(version_js_1.LIB_VERSION)
        .command('create', '📦 creates a new configuration for the a Chatbot')
        .command('show', '🚚 display the current chatbot configuration')
        .command('deploy', '🌟 deploys the chatbot to your account')
        .description('🛠️  Easily create a chatbots');
    program.parse(process.argv);
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFnaWMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtYWdpYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBLDJGQUEyRjs7QUFFM0YseUNBQXFDO0FBQ3JDLDZDQUEwQztBQUUxQyxDQUFDLEtBQUssSUFBSSxFQUFFO0lBQ1IsSUFBSSxPQUFPLEdBQUcsSUFBSSxtQkFBTyxFQUFFLENBQUM7SUFDNUIsT0FBTztTQUNGLE9BQU8sQ0FBQyx3QkFBVyxDQUFDO1NBQ3BCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsa0RBQWtELENBQUM7U0FDckUsT0FBTyxDQUFDLE1BQU0sRUFBQyw4Q0FBOEMsQ0FBQztTQUM5RCxPQUFPLENBQUMsUUFBUSxFQUFFLHdDQUF3QyxDQUFDO1NBQzNELFdBQVcsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0lBRWxELE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLENBQUMsQ0FBRSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlIFxuLy8gWW91IG1pZ2h0IHdhbnQgdG8gYWRkIHRoaXMgdG8gdGhlIHByZXZpb3VzIGxpbmUgLS1leHBlcmltZW50YWwtc3BlY2lmaWVyLXJlc29sdXRpb249bm9kZVxuXG5pbXBvcnQgeyAgQ29tbWFuZCB9IGZyb20gJ2NvbW1hbmRlcic7XG5pbXBvcnQgeyBMSUJfVkVSU0lPTiB9IGZyb20gJy4vdmVyc2lvbi5qcydcblxuKGFzeW5jICgpID0+eyBcbiAgICBsZXQgcHJvZ3JhbSA9IG5ldyBDb21tYW5kKCk7XG4gICAgcHJvZ3JhbVxuICAgICAgICAudmVyc2lvbihMSUJfVkVSU0lPTilcbiAgICAgICAgLmNvbW1hbmQoJ2NyZWF0ZScsICfwn5OmIGNyZWF0ZXMgYSBuZXcgY29uZmlndXJhdGlvbiBmb3IgdGhlIGEgQ2hhdGJvdCcpXG4gICAgICAgIC5jb21tYW5kKCdzaG93Jywn8J+amiBkaXNwbGF5IHRoZSBjdXJyZW50IGNoYXRib3QgY29uZmlndXJhdGlvbicpXG4gICAgICAgIC5jb21tYW5kKCdkZXBsb3knLCAn8J+MnyBkZXBsb3lzIHRoZSBjaGF0Ym90IHRvIHlvdXIgYWNjb3VudCcpXG4gICAgICAgIC5kZXNjcmlwdGlvbign8J+boO+4jyAgRWFzaWx5IGNyZWF0ZSBhIGNoYXRib3RzJyk7XG5cbiAgICBwcm9ncmFtLnBhcnNlKHByb2Nlc3MuYXJndik7XG59ICkoKTsiXX0=