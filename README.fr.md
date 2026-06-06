# Construction de cas d'utilisation RAG avec un ChatBot GenAI sur AWS

[![Notes de Version](https://img.shields.io/github/v/release/aws-samples/aws-genai-llm-chatbot)](https://github.com/aws-samples/aws-genai-llm-chatbot/releases)
[![Graphique des Étoiles GitHub](https://img.shields.io/github/stars/aws-samples/aws-genai-llm-chatbot?style=social)](https://star-history.com/#aws-samples/aws-genai-llm-chatbot)
[![Licence : MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Déployer avec GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://aws-samples.github.io/aws-genai-llm-chatbot/guide/deploy.html#deploy-with-github-codespaces)

[![Documentation Complète](https://img.shields.io/badge/Full%20Documentation-blue?style=for-the-badge&logo=Vite&logoColor=white)](https://aws-samples.github.io/aws-genai-llm-chatbot/)

![exemple](docs/about/assets/chabot-sample.gif "ChatBot GenAI sur AWS")


## 🚀 NOUVEAU ! Support des nouveaux modèles Amazon Nova 🚀
### Déployez ce chatbot pour utiliser les modèles Amazon Nova récemment annoncés [Amazon Nova models](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-frontier-intelligence-and-industry-leading-price-performance/)!
### Ces modèles puissants peuvent __comprendre__ et __générer__ des images et des vidéos.

Déployez ce chatbot pour expérimenter avec :
- `Amazon Nova Micro`
- `Amazon Nova Lite`
- `Amazon Nova Pro`
- `Amazon Nova Canvas`
- `Amazon Nova Reels`

Assurez-vous de demander l'accès aux nouveaux modèles [ici](https://aws-samples.github.io/aws-genai-llm-chatbot/documentation/model-requirements.html#amazon-bedrock-requirements)

En savoir plus sur les nouveaux modèles [ici](https://www.aboutamazon.com/news/aws/amazon-nova-artificial-intelligence-bedrock-aws)

---

Cette solution fournit un code prêt à l'emploi pour vous permettre de **commencer à expérimenter avec divers Modèles de Langage Larges et Modèles de Langage Multimodaux, paramètres et invites** dans votre propre compte AWS.

Fournisseurs de modèles pris en charge :

- [Amazon Bedrock](https://aws.amazon.com/bedrock/) qui prend en charge une large gamme de modèles d'AWS, Anthropic, Cohere et Mistral, y compris les derniers modèles d'Amazon Nova. Consultez les [Annonces récentes](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-frontier-intelligence-and-industry-leading-price-performance/) pour plus de détails.
- Modèles auto-hébergés [Amazon SageMaker](https://aws.amazon.com/sagemaker/) de Foundation, Jumpstart et HuggingFace.
- Fournisseurs tiers via API tels que Anthropic, Cohere, AI21 Labs, OpenAI, etc. [Consultez les intégrations langchain disponibles](https://python.langchain.com/docs/integrations/llms/) pour une liste complète.

# Ressources Supplémentaires

| Ressource | Description |
|:-------------|:-------------|
| [Chatbot GenAI Messager Sécurisé](https://github.com/aws-samples/secure-messenger-genai-chatbot) | Un messager construit avec Wickr qui peut interagir avec ce chatbot pour fournir un service de questions-réponses dans des environnements très réglementés (par exemple, HIPAA). |
| [Projet Lakechain](https://github.com/awslabs/project-lakechain) | Un puissant framework de traitement de documents (docs, images, audios, vidéos) natif du cloud, alimenté par l'IA, construit sur AWS CDK. |
| [Constructs CDK d'IA Générative AWS](https://github.com/awslabs/generative-ai-cdk-constructs/) | Bibliothèque open-source d'extension du [AWS Cloud Development Kit (AWS CDK)](https://docs.aws.amazon.com/cdk/v2/guide/home.html) visant à aider les développeurs à construire des solutions d'IA générative à l'aide de définitions d'architecture basées sur des modèles. |
| [Artefacts et Outils pour Bedrock](https://github.com/aws-samples/artifacts-and-tools-for-bedrock) | Une interface utilisateur innovante basée sur le chat avec support des outils et artefacts. Elle peut créer des graphiques et des diagrammes, analyser des données, écrire des jeux, créer des pages web, générer des fichiers, et bien plus encore. |

# Feuille de Route

La feuille de route est disponible via le [Projet GitHub](https://github.com/orgs/aws-samples/projects/69)

# Auteurs

- [Bigad Soleiman](https://www.linkedin.com/in/bigadsoleiman/)
- [Sergey Pugachev](https://www.linkedin.com/in/spugachev/)

# Contributeurs
[![contributeurs](https://contrib.rocks/image?repo=aws-samples/aws-genai-llm-chatbot&max=2000)](https://github.com/aws-samples/aws-genai-llm-chatbot/graphs/contributors)

# Licence

Cette bibliothèque est sous licence MIT-0. Consultez le fichier LICENSE.

- [Changelog](CHANGELOG.md) du projet.
- [Licence](LICENSE) du projet.
- [Code de Conduite](CODE_OF_CONDUCT.md) du projet.
- [CONTRIBUTION](CONTRIBUTING.md#security-issue-notifications) pour plus d'informations.

Bien que ce dépôt soit publié sous licence MIT-0, son interface utilisateur et son implémentation SQL utilisent les projets tiers suivants :
- [psycopg2-binary](https://github.com/psycopg/psycopg2)
- [jackspeak](https://github.com/isaacs/jackspeak)
- [package-json-from-dist](https://github.com/isaacs/package-json-from-dist)
- [path-scurry](https://github.com/isaacs/path-scurry)

Les licences de ces projets incluent les licences LGPL v3 et BlueOak-1.0.0.

# Clause de Non-Responsabilité Juridique

Vous devez envisager de faire votre propre évaluation indépendante avant d'utiliser le contenu de cet exemple pour un environnement de production. Cela peut inclure (entre autres) des tests, la sécurisation et l'optimisation du contenu fourni dans cet exemple, en fonction de vos propres pratiques et normes de contrôle qualité.
