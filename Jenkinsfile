@Library('nodejs-jenkins-pipeline-shared-library') _

def readProperties(){
	def properties_file_path = "${workspace}" + "@script/properties.yml"
	def property = readYaml file: properties_file_path

    return property
}

buildAndDeployApp(readProperties())