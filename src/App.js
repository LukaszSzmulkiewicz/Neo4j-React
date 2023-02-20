import { useState } from 'react';
const neo4j = require('neo4j-driver');
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "luki1234"));
const session = driver.session();

const driverHubmap = neo4j.driver("neo4j+s://d6ef9cdc.databases.neo4j.io", neo4j.auth.basic("neo4j", "woi9UqQga7vxsJI6T1-RRpPBRGXfS1DFwuI1NloU2uQ"));
const sessionHubmap = driverHubmap.session();

const parseResult = (result) => {
  console.log("passing to parse result", result)
  const parsedData = [];
  result.records.forEach((record) => {
    const n = record.get('n');
    const r = record.get('r');
    const m = record.get('m');
    
    if (n && n.properties) {
      parsedData.push({ 
        nodeType1: n.labels[1], 
        name: n.properties.name, 
        ontology_id1: n.properties.ontology_id,
        relationship: r ? r.type : null, 
        nodeType2: m.labels[1], 
        name2: m ? m.properties.name : null,
        ontology_id2: m.properties.ontology_id, 
      });
    }
  });
  return parsedData;
};

const parseResultHubmap = (result) => {
  const parsedData = [];
  console.log("Hubmup result pre processed",result)
  result.records.forEach((record) => {
    const path = record.get('path');
    
    if (path.end.properties.type ==="BM" || path.end.properties.type ==="CT") {
      const segments = [path.segments];
      const connectedSegments = [];
      if(segments[0].length > 1){
        const consolidatedSegments = segments.reduce((result, segment) => {
          let segmentTemp = [segment]
           result = '(start) is connected to: ';
          for (let i = 0; i < segmentTemp[0].length; i++) {
            if(i+1 === segmentTemp[0].length){
              result += segmentTemp[0][i].end.properties.name
            }else{
              result += segmentTemp[0][i].end.properties.name + " - is connected to: ";
            }
          }
      
          return result;
        }, "");
        connectedSegments.push(consolidatedSegments);
      }
   
      parsedData.push({ 
        start: path.start.properties.name, 
        ontology_id: path.start.properties.ontology_id,
        type: path.end.properties.type,
        end: path.end.properties.name, 
        path: connectedSegments.length > 0 ? connectedSegments : "direct link"
      });
     
    }
  });
  console.log("parsed humbap result", parsedData)
  parsedData.sort((a, b) => {
    if (a.ontology_id === b.ontology_id) {
      return (a.type > b.type) ? 1 : -1;
    }
    return (a.ontology_id > b.ontology_id) ? 1 : -1;
  });
    // Count the occurrences by type
  const counts = parsedData.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1;
    return acc;
  }, {});
  console.log("counts of hubmup data", counts)
  return parsedData;
};

const parseResultHubmap1 = (result) => {
  const parsedData = [];
  console.log("Hubmup result pre processed",result)
  result.records.forEach((record) => {
    const path = record.get('path');
    const hops = record.get('hops');
    
    if (path) {
      parsedData.push({ 
        path: path, 
        hops: hops, 
        });
    }
  });
  return parsedData;
};

const parseResultHubCtBm = (result) => {
  const parsedData = [];
  console.log("Hubmup result pre processed",result)
  result.records.forEach((record) => {
    const row = record.get('result');
    
    if (row) {
      parsedData.push({ 
        name: row.properties.name,
        type: row.properties.type 
        });
    }
  });
  return parsedData;
};


const getData = async (start, end, selectedPart) => {
  const query = `
        OPTIONAL MATCH (n)-[r]-(m) 
        WHERE n.position >= ${start} AND n.position <= ${end} AND n.is_part_of="${selectedPart}"
        RETURN n, r, m
        UNION
        OPTIONAL MATCH (n) 
        WHERE  n.start_position < ${start} AND n.end_position > ${end} AND n.is_part_of="${selectedPart}"
        RETURN n, null as r, null as m
  
  `;

  const result = await session.run(query);
  return parseResult(result);
};


const getDataHubmap = async (selectedOption, selectedPart, array) => {
  const filteredData = []
  console.log("unfiltered data", array);
  const setOfRegions = new Set(array.map(function(item) {

    if (item.ontology_id1) {
      return item.ontology_id1;
    } 
    if (item.ontology_id2) {
      return item.ontology_id2;
    } 
    return null;
    
  }));
  if (selectedOption.length > 0){

    setOfRegions.forEach(item => { selectedOption.forEach(option =>{
  
      console.log("checking item in forEach", item)
      if (item) {
        filteredData.push({name1: item, name2: option, organ: selectedPart});
      }
    })
    });
  }else {
    setOfRegions.forEach(item => {
      if (item) {
        filteredData.push({name1: item, organ: selectedPart});
      }
    })
  }
  console.log("filtered data", filteredData);
  const nodesString = filteredData.map(node => `{name1: ".*${node.name1}.*", name2: "${node.name2}", organ: "${node.organ}"}`).join(', ');
  console.log("hubmap data", nodesString);
  let query = ""
  if(selectedOption.length> 0){
    query = `
       WITH [${nodesString}] AS nodes 
       UNWIND nodes AS node
       WITH node, properties(node) as props
       MATCH (p {name: props.name2, organ: props.organ}) -[*]->(b {organ: props.organ})
       Where b.ontology_id=~node.name1
       CALL apoc.path.expandConfig(p, {
        relationshipFilter: "<is_part_of"
        })
        YIELD path
        RETURN path, length(path) AS hops
        ORDER BY hops;
      `;
    
  } else {
    query = `   
    WITH [${nodesString}] AS nodes 
    UNWIND nodes AS node
    WITH node, properties(node) as props
    MATCH (p)
    Where p.ontology_id=~node.name1
    CALL apoc.path.expandConfig(p, {
      relationshipFilter: "<is_part_of"
    })
    YIELD path
    RETURN path, length(path) AS hops
    ORDER BY hops;

`;
  }

  const result = await sessionHubmap.run(query);
 
  return parseResultHubmap(result);
};

function App() {
  
const array = [
{name1: 'duodenum', name2: "submucosa", organ:"small intestine"},
{name1: 'jejunum', name2: "mucosa", organ:"small intestine"}]
  const [data, setData] = useState([]);
  const [dataHubmap, setDataHubmap] = useState([]);

  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [selectedOrgan, setSelectedPart] = useState(' ');
  const [selectedOptions, setSelectedOptions] = useState([]);
 console.log("data length from fist query",data.length)

 const handleOptionChange = (event) => {
  const { value } = event.target;
  if (selectedOptions.includes(value)) {
    setSelectedOptions(selectedOptions.filter(option => option !== value));
  } else {
    setSelectedOptions([...selectedOptions, value]);
  }
};
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await getData(start, end, selectedOrgan);
    setData(result);
      console.log("printing result", result)    
      const resultHubmap = await getDataHubmap(selectedOptions,selectedOrgan, result);
      console.log("query result from the hubmap",resultHubmap.length)
      console.log("processed hubmap query", dataHubmap)
     await setDataHubmap(resultHubmap);
  };

  // if(data.length>0 && dataHubmap.length > 0){
  //   session.close();
  //   sessionHubmap.close();
  // }

  return (
    <div className="App">
      <header className="App-header">
      <form onSubmit={handleSubmit}>
      <input type="number" value={start} onChange={(e) => setStart(e.target.value)} />
      <input type="number" value={end} onChange={(e) => setEnd(e.target.value)} />
      <br />
      <input
        type="radio"
        id="largeIntestine"
        name="partSelection"
        value="large intestine"
        checked={selectedOrgan === 'large intestine'}
        onChange={(e) => setSelectedPart(e.target.value)}
      />
      <label>Large intestine (Distance: 0 - 1540)</label>
      <br />
      <input
        type="radio"
        id="smallIntestine"
        name="partSelection"
        value="small intestine"
        checked={selectedOrgan === 'small intestine'}
        onChange={(e) => setSelectedPart(e.target.value)}
      />
      <label>Small intestine (Distance: 0 - 4250)</label>
      <br />
      <h2>Search for a specific layer:</h2>
      <div>
        <input
          type="checkbox"
          value="serosa"
          checked={selectedOptions.includes("serosa")}
          onChange={handleOptionChange}
        />
        Serosa
      </div>
      <div>
        <input
          type="checkbox"
          value="submucosa"
          checked={selectedOptions.includes("submucosa")}
          onChange={handleOptionChange}
        />
        Submucosa
      </div>
      <div>
        <input
          type="checkbox"
          value="mucosa"
          checked={selectedOptions.includes("mucosa")}
          onChange={handleOptionChange}
        />
        Mucosa
      </div>
      <button type="submit">Submit</button>
    </form>
          <h1>EGCA result</h1>
        <ul>
         {data.map((record, index) => (
            <li key={index}>
              {record.nodeType1}: "{record.name}"{record.nodeType2 ? ` for ${record.nodeType2}: ${record.name2}` : ''}
            </li>
          ))}
        </ul>
        <br/>
        
      <h1>HUBMAP result</h1>
      <ul>
          {" "}
          {dataHubmap.map((record, index) => (
            <li key={index}> {JSON.stringify(record)} </li>
          ))}{" "}
        </ul>{" "}
      </header>
    </div>
  );
}

export default App;