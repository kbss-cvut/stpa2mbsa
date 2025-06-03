const ontologyHeader = `
@prefix stpa: <http://www.fd.cvut.cz/chopamax/ontologies/stpa-mbsa#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

stpa: a owl:Ontology ;
    owl:versionIRI stpa:v0.1 .

################################################
##  Classes
################################################

stpa:LossScenario a owl:Class .
stpa:ScenarioControllerAssociation a owl:Class .
stpa:ScenarioProcessAssociation a owl:Class .
stpa:Controller a owl:Class .
stpa:ControlAction a owl:Class .
stpa:ControlledProcess a owl:Class .

################################################
##  Object Properties
################################################

stpa:belongs-to-scenario a owl:ObjectProperty ;
    rdfs:domain stpa:ScenarioControllerAssociation, stpa:ScenarioProcessAssociation ;
    rdfs:range stpa:LossScenario ;
    rdfs:label "belongs-to-scenario" .

stpa:has-controller a owl:ObjectProperty ;
    rdfs:domain stpa:ScenarioControllerAssociation ;
    rdfs:range stpa:Controller ;
    rdfs:label "has-controller" .

stpa:has-control-action a owl:ObjectProperty ;
    rdfs:domain stpa:LossScenario ;
    rdfs:range stpa:ControlAction ;
    rdfs:label "has-control-action" .

stpa:has-controlled-process a owl:ObjectProperty ;
    rdfs:domain stpa:LossScenario ;
    rdfs:range stpa:ControlledProcess ;
    rdfs:label "has-controlled-process" .

stpa:has-process a owl:ObjectProperty ;
    rdfs:domain stpa:ScenarioProcessAssociation ;
    rdfs:range stpa:ControlledProcess ;
    rdfs:label "has-process" .

################################################
##  Data Properties
################################################

stpa:provided-status a owl:DatatypeProperty ;
    rdfs:domain stpa:ScenarioControllerAssociation ;
    rdfs:range xsd:string ;
    rdfs:label "provided-status" .

stpa:feedback-status a owl:DatatypeProperty ;
    rdfs:domain stpa:ScenarioControllerAssociation ;
    rdfs:range xsd:string ;
    rdfs:label "feedback-status" .

stpa:scenario-class a owl:DatatypeProperty ;
    rdfs:domain stpa:LossScenario ;
    rdfs:range xsd:string ;
    rdfs:label "scenario-class" .

stpa:original-text a owl:DatatypeProperty ;
    rdfs:domain stpa:LossScenario ;
    rdfs:range xsd:string ;
    rdfs:label "original-text" .

stpa:context a owl:DatatypeProperty ;
    rdfs:domain stpa:LossScenario ;
    rdfs:range xsd:string ;
    rdfs:label "context" .

stpa:name a owl:DatatypeProperty ;
    rdfs:domain stpa:Controller ;
    rdfs:range xsd:string ;
    rdfs:label "name" .

stpa:process-reception-status a owl:DatatypeProperty ;
    rdfs:domain stpa:ScenarioProcessAssociation ;
    rdfs:range xsd:string ;
    rdfs:label "process-reception-status" .

stpa:process-execution-status a owl:DatatypeProperty ;
    rdfs:domain stpa:ScenarioProcessAssociation ;
    rdfs:range xsd:string ;
    rdfs:label "process-execution-status" .
`;