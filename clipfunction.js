import { Stage, Layer, Group, Circle } from 'react-konva';

const App = () => {
  const blobs = Array.from({ length: 20 }, (_, i) => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    radius: Math.random() * 50,
  }));

  return (
    <Stage width={window.innerWidth} height={window.innerHeight}>
      <Layer>
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.arc(200, 120, 50, 0, Math.PI * 2, false);
            ctx.arc(280, 120, 50, 0, Math.PI * 2, false);
          }}
        >
          {blobs.map((blob, i) => (
            <Circle
              key={i}
              x={blob.x}
              y={blob.y}
              radius={blob.radius}
              fill="green"
              opacity={0.8}
            />
          ))}
        </Group>
      </Layer>
    </Stage>
  );
};

export default App;
