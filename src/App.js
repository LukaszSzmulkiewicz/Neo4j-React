import { useState } from "react";

// neo4j driver 
const HGCA_DB_NAME = "neo4j";
const HGCA_PASSWORD = "neoapp123";

const HuBMAP_DB_NAME = "neo4j";
const HuBMAP_PASSWORD = "";

const neo4j = require("neo4j-driver");
const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic(HGCA_DB_NAME, HGCA_PASSWORD)
);
const session = driver.session();

const driverHubmap = neo4j.driver(
  "neo4j+s://"...".databases.neo4j.io",
  neo4j.auth.basic(HuBMAP_DB_NAME, HuBMAP_PASSWORD)
);
const sessionHubmap = driverHubmap.session();

const parseResult = (result) => {
  console.log("passing to parse result", result);
  const parsedData = [];
  result.records.forEach((record) => {
    const n = record.get("n");
    const r = record.get("r");
    const m = record.get("m");

    if (n && n.properties) {
      parsedData.push({
        nodeType1: n.labels,
        name: n.properties.name,
        ontology_id1: n.properties.ontology_id,
        relationship: r ? r.type : null,
        nodeType2: m? m.labels : null,
        name2: m ? m.properties.name : null,
        ontology_id2: m ? m.properties.ontology_id : null,
      });
    }
  });
  console.log("parsed result", parsedData)
  return parsedData;
};

const parseResultHubmap = (result) => {
  const parsedData = [];

  // sets for result testing 
  let as = new Set();
  let bm = new Set();
  let ct = new Set();
  console.log("Hubmup result pre processed", result);
  result.records.forEach((record) => {
    const path = record.get("path");

      const segments = [path.segments];
      const connectedSegments = [];
      if (segments[0].length > 1) {
        const consolidatedSegments = segments.reduce((result, segment) => {
          let segmentTemp = [segment];
          let nodeType;

          result = `(start node)  <-is_part_of-: `;
          for (let i = 0; i < segmentTemp[0].length; i++) {
            if (i + 1 === segmentTemp[0].length) {
              result += segmentTemp[0][i].end.properties.name;
            } else {
              result +=
                segmentTemp[0][i].end.properties.name + " <-is_part_of-: ";

            }
          }
          
          
          return result;
        }, "");
        connectedSegments.push(consolidatedSegments);
        
      }
      const startType = path.start.properties.type
      const startName = path.start.properties.name
      const endType =  path.end.properties.type
      const endName = path.end.properties.name
      if (startType === "AS" && !as.has(startName)) {
        as.add(startName);
      } else if (endType === "AS" && !as.has(endName)) {
        as.add(endName);
      } else if (startType === "CT" && !ct.has(startName)) {
        ct.add(startName);
      } else if (endType === "CT" && !ct.has(endName)) {
        ct.add(endName);
      } else if (startType === "BM" && !bm.has(startName)) {
        bm.add(startName);
      } else if (endType === "BM" && !bm.has(endName)) {
        bm.add(endName);
      }



      parsedData.push({
        start: path.start.properties.name,
        start_type: path.start.properties.type,
        ontology_id: path.start.properties.ontology_id,
        end: path.end.properties.name,
        end_type: path.end.properties.type,
        ontology_id_end: path.end.properties.ontology_id,
        path: connectedSegments.length > 0 ? connectedSegments : "direct link",
      });
    });
    // console log for testing of HuBMAP result
    console.log("as - size", as.size);
    console.log("as", [...as].join(', '));
    console.log("bm - size", bm.size);
    console.log("bm", [...bm].join(', '));
    console.log("as - size", ct.size);
    console.log("ct", [...ct].join(', '));
  console.log("parsed humbap result", parsedData);
  parsedData.sort((a, b) => {
    if (a.ontology_id === b.ontology_id) {
      return a.type > b.type ? 1 : -1;
    }
    return a.ontology_id > b.ontology_id ? 1 : -1;
  });
  // Count the occurrences by type
  const counts = parsedData.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1;
    return acc;
  }, {});
  console.log("counts of hubmup data", counts);
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
  const filteredData = [];
  const filteredArray = [];
  console.log("unfiltered data", array);
  for(let i = 0; i < array.length; i++){
     console.log("in the loop", array[i])
      if(array[i].ontology_id1){

        filteredArray.push(array[i].ontology_id1)
    }
    if(array[i].ontology_id2){

      filteredArray.push(array[i].ontology_id2)
  }
      }

      console.log("filtered array", filteredArray)
  const setOfRegions = new Set(filteredArray);
  console.log("unfiltered data set", setOfRegions);
  if (selectedOption.length > 0) {
    setOfRegions.forEach((item) => {
      selectedOption.forEach((option) => {
        console.log("checking item in forEach", item);
        if (item) {
          filteredData.push({
            name1: item,
            name2: option,
            organ: selectedPart,
          });
        }
      });
    });
  } else {
    setOfRegions.forEach((item) => {
      if (item) {
        filteredData.push({ name1: item, organ: selectedPart });
      }
    });
  }
  console.log("filtered data", filteredData);
  const nodesString = filteredData
    .map(
      (node) =>
        `{name1: ".*${node.name1}.*", name2: ".*${node.name2}.*", organ: "${node.organ}"}`
    )
    .join(", ");
  console.log("hubmap data", nodesString);
  let query = "";
  if (selectedOption.length > 0) {
    query = `
       WITH [${nodesString}] AS nodes 
       UNWIND nodes AS node
       WITH node, properties(node) as props
       MATCH (p { organ: props.organ})<-[is_part_of*]-(b {organ: props.organ})
       Where p.ontology_id=~node.name1 and b.name=~node.name2
       CALL apoc.path.expandConfig(b, {
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
    MATCH (p{ organ: props.organ})
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
    { name1: "duodenum", name2: "submucosa", organ: "small intestine" },
    { name1: "jejunum", name2: "mucosa", organ: "small intestine" },
  ];
  const [data, setData] = useState([]);
  const [dataHubmap, setDataHubmap] = useState([]);

  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [selectedOrgan, setSelectedPart] = useState(" ");
  const [selectedOptions, setSelectedOptions] = useState([]);
  console.log("data length from fist query", data.length);

  const handleOptionChange = (event) => {
    const { value } = event.target;
    if (selectedOptions.includes(value)) {
      setSelectedOptions(selectedOptions.filter((option) => option !== value));
    } else {
      setSelectedOptions([...selectedOptions, value]);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await getData(start, end, selectedOrgan);
    setData(result);
    const resultHubmap = await getDataHubmap(
      selectedOptions,
      selectedOrgan,
      result
    );
    await setDataHubmap(resultHubmap);
  };

  // if(data.length>0 && dataHubmap.length > 0){
  //   session.close();
  //   sessionHubmap.close();
  // }

  return (
    <div className="App">
      <header className="App-header">
        <div class="main-container">
          <h1>EHGCA/ HuBMAP models viewer</h1>
          <div class="menu-box">
            <form onSubmit={handleSubmit}>
              <div class="row-container">
                <label>
                  <b>Select organ: </b>
                </label>
                <div class="row-item">
                  <input
                    type="radio"
                    id="largeIntestine"
                    name="partSelection"
                    value="large intestine"
                    checked={selectedOrgan === "large intestine"}
                    onChange={(e) => setSelectedPart(e.target.value)}
                  />
                  <label>Large intestine (Distance: 0 - 1540)</label>
                </div>

                <div class="row-item">
                  <input
                    type="radio"
                    id="smallIntestine"
                    name="partSelection"
                    value="small intestine"
                    checked={selectedOrgan === "small intestine"}
                    onChange={(e) => setSelectedPart(e.target.value)}
                  />
                  <label>Small intestine (Distance: 0 - 4250)</label>
                </div>
              </div>
              <div class="row-container">
                <label>
                  <b> Organ distance: </b>
                </label>
                <div class="row-item">
                  <label>start </label>
                  <input
                    type="number"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div class="row-item">
                  <label>end </label>

                  <input
                    type="number"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              <div class="row-container">
                <label>
                  <b>Gut layers:</b>
                </label>
                <div class="row-item">
                  <input
                    type="checkbox"
                    value="serosa"
                    checked={selectedOptions.includes("serosa")}
                    onChange={handleOptionChange}
                  />
                  <label>Serosa</label>
                </div>
                <div class="row-item">
                  <input
                    type="checkbox"
                    value="muscularis"
                    checked={selectedOptions.includes("muscularis")}
                    onChange={handleOptionChange}
                  />
                  <label>Muscularis</label>
                </div>
                <div class="row-item">
                  <input
                    type="checkbox"
                    value="submucosa"
                    checked={selectedOptions.includes("submucosa")}
                    onChange={handleOptionChange}
                  />
                   <label>Submucosa</label>
                </div>
            
                <div class="row-item">
                  <input
                    type="checkbox"
                    value="mucosa"
                    checked={selectedOptions.includes("mucosa")}
                    onChange={handleOptionChange}
                  />
                  <label>Mucosa</label>
                </div>
                <div class="row-item">
                  <input
                    type="checkbox"
                    value="lumen"
                    checked={selectedOptions.includes("lumen")}
                    onChange={handleOptionChange}
                  />
                  <label>Lumen</label>
                </div>
              </div>
              <div class="row-item">
                <button type="submit">Submit Request</button>
              </div>
            </form>
          </div>
          <h1>EHGCA result</h1>
          <div class="EGCA-table-container">
            <table class="table table-striped">
              <thead>
                <tr>
                {data.length === 1 ? <th class="th-gca">Region</th> : <th class="th-gca">Landmark</th>}
                  <th class="th-gca">Ontology ID</th>
                  <th class="th-gca">Relationship</th>
                  <th class="th-gca">Region</th>
                  <th class="th-gca">Ontology ID</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record, index) => {
                  return (
                    <tr class="tr-gca" key={index}>
                      <td class="td-gca">{record.name}</td>
                      <td class="td-gca">{record.ontology_id1}</td>
                      {data.length === 1 ? <td class="td-gca"></td> :<td class="td-gca">{`:-Landmark-For->`}</td> }
                      <td class="td-gca">
                        {record.nodeType2 ? ` ${record.name2}` : ""}
                      </td>
                      <td class="td-gca">{record.ontology_id2}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <br />
          <h1>HUBMAP result</h1>
          <div class="Hub-table-container">
            <table class="table table-striped-hub">
              <thead>
                <th></th>
              </thead>

              <tbody class="tbody-hub">
                {dataHubmap.map((record, index) => {
                  return (
                    <tr  class="tr-hub" key={index}>
                  

                      <tr class="tr-hub-first">
                        <div class ="tr-first-wrapper">
                        <td class="td-heading"><b>Start Node: </b></td>
                        <td><b>Name:</b> {record.start}</td>
                        <td><b>Type: </b>{record.start_type}</td>
                        <td><b>Ontology ID: </b>{record.ontology_id}</td>
                        </div>
                        <div class ="tr-first-wrapper">
                        <td class="td-heading"><b>End Node: </b></td>
                        <td><b>Name:</b> {record.end}</td>
                        <td><b>Type: </b>{record.end_type}</td>
                        <td><b>Ontology ID: </b>{record.ontology_id_end}</td>
                        </div>
                      </tr>
                      <tr class="tr-path">
                        <td class="td-path" colspan="8"><b>Path: </b>{record.path}</td>
                      </tr>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </header>
    </div>
  );
}
const parseResultHubmap1 = (result) => {
  const parsedData = [];
  console.log("Hubmup result pre processed", result);
  result.records.forEach((record) => {
    const path = record.get("path");
    const hops = record.get("hops");

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
  console.log("Hubmup result pre processed", result);
  result.records.forEach((record) => {
    const row = record.get("result");

    if (row) {
      parsedData.push({
        name: row.properties.name,
        type: row.properties.type,
      });
    }
  });
  return parsedData;
};

export default App;
