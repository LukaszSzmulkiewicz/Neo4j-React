import React, { useState, useEffect } from 'react';
const neo4j = require('neo4j-driver');
const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "luki1234"));
const session = driver.session();

const parseResult = (result) => {
  const parsedData = [];
  result.records.forEach((record) => {
    const n = record.get('n');
    const r = record.get('r');
    const m = record.get('m');
    
    if (n && n.properties) {
      parsedData.push({ 
        nodeType: n.labels[1], 
        name: n.properties.name, 
        relationship: r ? r.type : null, 
        NodeType2: m.labels[1], 
        name2: m ? m.properties.name : null });
    }
  });
  return parsedData;
};

const getData = async (start, end) => {
  const query = `
  OPTIONAL MATCH (n)-[r]-(m) 
  WHERE n.position >= ${start} AND n.position <= ${end} AND n.is_part_of="large intestine"
  RETURN n, r, m
  UNION
  OPTIONAL MATCH (n) 
  WHERE  n.start_position < ${start} AND n.end_position > ${end} AND n.is_part_of="large intestine"
  RETURN n, null as r, null as m
  `;

  const result = await session.run(query);
  return parseResult(result);
};

function App() {
  const [data, setData] = useState([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
 console.log("data",data.length)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await getData(start, end);
    setData(result);
  };

  return (
    <div className="App">
      <header className="App-header">
        <form onSubmit={handleSubmit}>
          <input type="number" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="number" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button type="submit">Submit</button>
        </form>
        <ul>
            {data.length > 1
          ? data.map((record, index) => (
              <li key={index}>
                {record.nodeType}: "{record.name}" for {record.NodeType2}: {record.name2}
              </li>
            ))
          :  data.map((record, index) => (
            <li key={index}>
              {record.nodeType} {record.name} 
            </li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;