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
    }
}