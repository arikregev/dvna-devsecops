## Demo Pre-Requisites

- Jenkins Server
- SonarQube Server
- [OWASP Dependency-Check Plugin](https://plugins.jenkins.io/dependency-check-jenkins-plugin) installed in Jenkins
- To build images using Buildah, you need to create one service account and you need to assign it the ability to run as the standard anyuid [SCC](https://docs.openshift.com/container-platform/4.3/authentication/managing-security-context-constraints.html) (See setup below)
- You need authentication to publish scan reports to SonarQube (See setup below)
- You need authentication to publish scan reports to ArcherySec (See setup below)
- You need authentication to push images to registry and also to pull images for slave pods (See setup below)

## Setup

#### Buildah Setup
```
oc create sa buildah-sa

oc adm policy add-scc-to-user anyuid -z buildah-sa
```


#### Authentication

Create credentials in Jenkins as shown in below image:

<img src="./creds.PNG">
