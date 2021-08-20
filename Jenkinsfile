@Library('nodejs-jenkins-pipeline-shared-library') _

pipeline {
    agent none

    stages {
        stage('Read Properties') {
            agent any

            steps {
                script {
                    properties = readYaml file: "properties.yaml"
                }
            }
        }

        stage('Unit Testing & Code Coverage') {
            agent {
                kubernetes {
                    yamlFile "${properties.NODEJS_SLAVE_YAML}"
                }
            }

            steps {
                container('nodejs') {
                    script {
                        unitTestingAndCodeCoverageUsingJest()
                    }
                    stash includes: 'coverage/*', name: 'coverage-report' 
                    stash includes: 'node_modules/', name: 'node_modules' 
                }
            }    
        }

        stage('Security Testing'){
            parallel {
                stage('Static Application Security Testing') {
                    agent {
                        kubernetes {
                            yamlFile "${properties.NODEJSSCAN_SLAVE_YAML}"
                        }
                    }
                    
                    steps {
                        container('nodejsscanner') {
                            script {
                                sastUsingNodeJsScan()
                            }
                        }
                    }
                }

                stage('Software Composition Analysis') {
                    agent {
                        kubernetes {
                            yamlFile "${properties.OWASP_DEPENDENCY_CHECK_SLAVE_YAML}"
                        }
                    }
                    
                    steps {
                        container('owasp-dependency-checker') {
                            unstash 'node_modules'
                            script {
                                scaUsingOwaspDependencyCheck('DVNA', "${properties.PACKAGE_JSON_PATH}")
                            }
                            stash includes: "dependency-check-report.xml,dependency-check-report.json,dependency-check-report.html", name: 'owasp-reports'
                        }
                    }
                }
            }
        }

        stage('Code Quality Analysis') {
            agent {
                kubernetes {
                    yamlFile "${properties.SONAR_SCANNER_SLAVE_YAML}"
                }
            }
            steps {
                container('sonar-scanner') {
                    withCredentials([usernamePassword(credentialsId: 'sonarqube-creds', usernameVariable: 'SONAR_USERNAME', passwordVariable: 'SONAR_PASSWORD')]) {
                        unstash 'coverage-report'
                        unstash 'owasp-reports'
                        script {
                            codeQualityCheckUsingSonarQube("${properties.SONAR_HOST_URL}", "${SONAR_PASSWORD}")
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            agent {
                kubernetes {
                    yamlFile "${properties.BUILDAH_SLAVE_YAML}"
                }
            }
            steps {
                container('buildah') {
                    script {
                        buildDockerImageUsingBuildah("${properties.APP_NAME}", "${BUILD_NUMBER}", "${properties.DOCKERFILE_PATH}")
                    }
                    stash includes: "${properties.APP_NAME}_${BUILD_NUMBER}.tar", name: 'docker-image' 
                }
            }
        }

        stage('Scan Docker Image') {
            agent {
                kubernetes {
                    yamlFile "${properties.TRIVY_SLAVE_YAML}"
                }
            }
            steps {
                container('trivy-scanner') {
                    unstash 'docker-image'
                    sh "mkdir -p /tmp/trivy"
                    sh "chmod 754 /tmp/trivy"
                    script {
                        scanDockerImageUsingTrivy("${properties.APP_NAME}", "${BUILD_NUMBER}")
                    }
                    stash includes: 'trivy-report.json', name: 'trivy-report'                 
                }
            }
        }

        stage('Push Docker Image') {
            agent {
                kubernetes {
                    yamlFile "${properties.BUILDAH_SLAVE_YAML}"
                }
            }
            steps {
                container('buildah') {
                    withCredentials([usernamePassword(credentialsId: 'docker-registry-creds', usernameVariable: 'DOCKER_REGISTRY_USERNAME', passwordVariable: 'DOCKER_REGISTRY_PASSWORD')]) {
                        unstash 'docker-image'
                        script {
                            pullDockerImageUsingBuildah("${DOCKER_REGISTRY_USERNAME}", "${DOCKER_REGISTRY_PASSWORD}", "${properties.DOCKER_REGISTRY_URL}", "${properties.APP_NAME}", "${BUILD_NUMBER}")
                            pushDockerImageUsingBuildah("${DOCKER_REGISTRY_USERNAME}", "${DOCKER_REGISTRY_PASSWORD}", "${properties.DOCKER_REGISTRY_URL}", "${properties.APP_NAME}", "${BUILD_NUMBER}")
                        }
                    }    
                }
            }
        } 

        stage('Deploy App in Staging') {
            agent any

            steps {
                withKubeConfig([credentialsId: 'k8s-cluster-creds', serverUrl: "${properties.KUBERNETES_CLUSTER_URL}"]) {
                    sh "sed -i 's/IMAGE_NAME/${properties.APP_NAME}/g' ${properties.STAGING_KUSTOMIZATION_DIRECTORY}/kustomization.yaml"
                    sh "sed -i 's/IMAGE_TAG/${BUILD_NUMBER}/g' ${properties.STAGING_KUSTOMIZATION_DIRECTORY}/kustomization.yaml"
                    script {
                        deployUsingKustomize("${properties.STAGING_NAMESPACE}", "${properties.STAGING_KUSTOMIZATION_DIRECTORY}")
                    }
                }
            }
        }

        stage('Functional Testing') {
            agent {
                kubernetes {
                    yamlFile "${properties.NEWMAN_SLAVE_YAML}"
                }
            }
            steps {
                container('newman') {
                    sh "sed -i 's/APP_URL/${properties.APP_STAGING_TARGET_URL}/g' ${properties.POSTMAN_COLLECTION_FILE_PATH}"
                    script {
                        functionalTestingUsingPostmanNewman("${properties.POSTMAN_COLLECTION_FILE_PATH}")
                    }
                    junit 'newman-report.xml'
                }
            }
        }

        stage('Dynamic Application Security Testing') {
            agent {
                kubernetes {
                    yamlFile "${properties.ZAP_SLAVE_YAML}"
                }
            }
            steps {
                container('zap') {
                    script {
                        dastUsingZap("http://${properties.APP_STAGING_TARGET_URL}")
                    }   
                    stash includes: 'zap-report.xml', name: 'zap-report'                        
                }
            }
        }

        stage('Load Testing') {
            agent {
                kubernetes {
                    yamlFile "${properties.ARTILLERY_SLAVE_YAML}"
                }
            }
            steps {
                container('artillery') {
                    script {
                        loadTestingUsingArtillery("staging", "http://${properties.APP_STAGING_TARGET_URL}", "${properties.ARTILLERY_CONFIG_FILE_PATH}")
                    }
                }
            }
        }

        stage('Publish Reports to ArcherySec') {
            agent {
                kubernetes {
                    yamlFile "${properties.ARCHERYSEC_SLAVE_YAML}"
                }
            }
            steps {
                container('archerysec-cli') {
                    withCredentials([usernamePassword(credentialsId: 'archerysec-creds', usernameVariable: 'ARCHERYSEC_USERNAME', passwordVariable: 'ARCHERYSEC_PASSWORD')]) {
                        unstash 'owasp-reports'
                        unstash 'trivy-report' 
                        unstash 'zap-report'
                        script {
                            publishReportToArcherySec("${properties.ARCHERYSEC_HOST_URL}", "${ARCHERYSEC_USERNAME}", "${ARCHERYSEC_PASSWORD}", "XML", "dependency-check-report.xml", "DVNA_OWASP", "dependencycheck", "${properties.ARCHERYSEC_PROJECT_ID}")
                            
                            publishReportToArcherySec("${properties.ARCHERYSEC_HOST_URL}", "${ARCHERYSEC_USERNAME}", "${ARCHERYSEC_PASSWORD}", "JSON", "trivy-report.json", "DVNA_TRIVY", "trivy", "${properties.ARCHERYSEC_PROJECT_ID}")
                            
                            publishReportToArcherySec("${properties.ARCHERYSEC_HOST_URL}", "${ARCHERYSEC_USERNAME}", "${ARCHERYSEC_PASSWORD}", "XML", "zap-report.xml", "DVNA_ZAP", "zap_scan", "${properties.ARCHERYSEC_PROJECT_ID}")
                        }
                    }    
                }
            }
        }

        stage('Deploy App in Production') {
            agent any

            steps {
                withKubeConfig([credentialsId: 'k8s-cluster-creds', serverUrl: "${properties.KUBERNETES_CLUSTER_URL}"]) {
                    sh "sed -i 's/IMAGE_NAME/${properties.APP_NAME}/g' ${properties.PRODUCTION_KUSTOMIZATION_DIRECTORY}/kustomization.yaml"
                    sh "sed -i 's/IMAGE_TAG/${BUILD_NUMBER}/g' ${properties.PRODUCTION_KUSTOMIZATION_DIRECTORY}/kustomization.yaml"
                    script {
                        deployUsingKustomize("${properties.PRODUCTION_NAMESPACE}", "${properties.PRODUCTION_KUSTOMIZATION_DIRECTORY}")
                    }
                }
            }
        }
    }
}