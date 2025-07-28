# STPA2MBSA
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15729580.svg)](https://doi.org/10.5281/zenodo.15729580)

This repository contains the source code, scripts, and data for the methodology presented in the paper: **"Achieving MBSA Simulation of STPA Loss Scenarios: An Integration Guideline for Aircraft Safety"**.
  
The project provides an ontology-driven toolchain to formally bridge the gap between System-Theoretic Process Analysis (STPA) and Model-Based Safety Analysis (MBSA), enabling the automated generation of MBSA observers from STPA loss scenarios.  

## Features
  

- **Vocabulary Extraction:** Programmatically generates a formal MBSA vocabulary from system design files.    
- **Scenario Formalization:** Converts textual STPA loss scenarios into a structured RDF format.    
- **Annotation Support:** Creates pre-annotated HTML files to facilitate the manual annotation process.    
- **Observer Generation:** Automatically assembles formal MBSA observers from annotated scenarios using SPARQL queries.    
- **End-to-End Traceability:** Establishes a digital thread from high-level scenarios to low-level MBSA component states.

## Repository Structure  
  

    stpa2mbsa/  
    ├── bin/                   # Core Python and Shell scripts for the pipeline  
    ├── data/                  # Input data for different case studies  
    │   ├── ElectricalSystem/  
    │   │   ├── loss-scenarios.ttl  
    │   │   └── Electrical_System_equipment.xlsx
    │   └── ...  
    ├── docs/                  # Supplementary documentation and data from the article  
    ├── pipeline_output/       # Default directory for generated artifacts  
    │   ├── ElectricalSystem/  
    │   │   ├── equipment.ttl  
    │   │   ├── observer_results.json  
    │   │   └── ...  
    │   └── ...  
    ├── s_pipes_scripts/       # Scripts for data transformation  
    └── stpaMasterLite/        # Google Apps Script project for STPA analysis  

  
## Prerequisites  
  
To run the full pipeline, you will need:  

- [Python 3.x](https://www.python.org/downloads/)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [GraphDB](https://www.ontotext.com/products/graphdb/)
- A Unix-like shell environment (e.g., bash) to execute the scripts.  
    
## Installation 

 
  
 

1. **Clone the repository:**
```bash
git clone https://github.com/kbss-cvut/stpa2mbsa 
```
2. **Install Docker and Docker Compose**
3. **Clone and install S-Pipes:**
```bash
git clone https://github.com/kbss-cvut/s-pipes/
cd s-pipes
docker build -t s-pipes-engine .
```
4. **Install and Run GraphDB**
   - Follow the [GraphDB installation guide](https://www.ontotext.com/products/graphdb/installation/) to set up a local instance.
   - Ensure the GraphDB server is running and accessible.
   - Create a new repository within GraphDB to store the project's knowledge graph.

5. **Check-out `stpa2mbsa` repository**
6. **Ensure Python dependencies are installed:**
```bash 
python -m venv stpa2mbsa_venv
source stpa2mbsa_venv/bin/activate
pip install -r requirements.txt
```
7. **Set up the configuration file:**
   - Create a `pipeline.conf` file in the root directory of the project.
   - Configure the paths to your GraphDB instance, S-Pipes engine, and any other necessary parameters. Use the provided `pipeline.example.conf` as a template.
  
## Workflow
The end-to-end process involves preliminary manual analysis followed by an interactive, script-driven pipeline.

### Step 1: Preliminary Analysis
Before running the automated pipeline, the user must perform the STPA and MBSA analyses in their respective tools.
1.  **MBSA Analysis**: Create the system model in an MBSA tool (e.g., [SimfiaNeo](https://www.protect.airbus.com/safety/simfianeo/)) and export the component list to a spreadsheet (e.g., `data/ElectricalSystem/Electrical_System_equipment.xlsx`).
2.  **STPA Analysis**: Perform the STPA, ideally using the **STPAMasterLite** tool provided in this repository.
3.  **Generate Scenarios**: From the STPA tool, export the loss scenarios as a Turtle file (`loss-scenarios.ttl`) and place it in the appropriate `data/<dataset_name>/` directory.

### Step 2: Run the Automated Pipeline

With the preliminary artifacts in place, execute the main script from the root directory:

```bash
./bin/run-pipeline.sh
```
This script initiates the automated process, which includes:
- Extracting the MBSA vocabulary from the spreadsheet.
- Generating a pre-annotated HTML file for the annotation step.

### Step 3: Mapping
At a certain point, the pipeline will pause, and the user will be prompted to perform the mapping. The user can use any preferred method for it (e.g., using a spreadsheet or a custom script). In this project's implementation, the workflow is designed to use the semantic annotation tool [TermIt](https://github.com/kbss-cvut/termit).

If the user chooses to use TermIt, the following steps are performed:

- The script will provide the path to a newly generated HTML file (i.e., loss-scenario_for_termit.html).
- Import the document in the newly created vocabulary in TermIt.
- Perform the annotation by linking textual phrases in the loss scenarios to the corresponding MBSA vocabulary terms.
- Save the output of the annotation tool as annotated-loss-scenarios.html in the correct `data/<dataset_name>/` directory.

### Step 4: Observer Generation
Once the `annotated-loss-scenarios.html` file is saved, the user can return to the terminal and press Enter to resume the pipeline. The script will then complete the final steps, including executing SPARQL queries to process the annotations and generating the final MBSA observers. All outputs will be placed in the `pipeline_output/` directory.
## License  

This project is licensed under the MIT License.
