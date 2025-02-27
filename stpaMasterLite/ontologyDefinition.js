const ontologyHeader = `
@prefix : <http://www.fd.cvut.cz/chopamax/ontologies/stpa-mbsa#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

################################################
##  Classes
################################################

:LossScenario a owl:Class .
:ScenarioControllerAssociation a owl:Class .
:Controller a owl:Class .
:ControlAction a owl:Class .
:ControlledProcess a owl:Class .

################################################
##  Object Properties
################################################

:belongs-to-scenario a owl:ObjectProperty ;
    rdfs:domain :ScenarioControllerAssociation ;
    rdfs:range :LossScenario ;
    rdfs:label "belongs-to-scenario" .

:has-controller a owl:ObjectProperty ;
    rdfs:domain :ScenarioControllerAssociation ;
    rdfs:range :Controller ;
    rdfs:label "has-controller" .

:has-control-action a owl:ObjectProperty ;
    rdfs:domain :LossScenario ;
    rdfs:range :ControlAction ;
    rdfs:label "has-control-action" .

:has-controlled-process a owl:ObjectProperty ;
    rdfs:domain :LossScenario ;
    rdfs:range :ControlledProcess ;
    rdfs:label "has-controlled-process" .

################################################
##  Data Properties
################################################

:provided-status a owl:DatatypeProperty ;
    rdfs:domain :ScenarioControllerAssociation ;
    rdfs:range xsd:string ;
    rdfs:label "provided-status" .

:feedback-status a owl:DatatypeProperty ;
    rdfs:domain :ScenarioControllerAssociation ;
    rdfs:range xsd:string ;
    rdfs:label "feedback-status" .

:scenario-class a owl:DatatypeProperty ;
    rdfs:domain :LossScenario ;
    rdfs:range xsd:string ;
    rdfs:label "scenario-class" .

:original-text a owl:DatatypeProperty ;
    rdfs:domain :LossScenario ;
    rdfs:range xsd:string ;
    rdfs:label "original-text" .

:context a owl:DatatypeProperty ;
    rdfs:domain :LossScenario ;
    rdfs:range xsd:string ;
    rdfs:label "context" .

:name a owl:DatatypeProperty ;
    rdfs:domain :Controller ;
    rdfs:range xsd:string ;
    rdfs:label "name" .
`;
