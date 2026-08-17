import { Handle, Position } from "@xyflow/react";

const handleClass =
  "!h-4 !w-4 !border-2 !border-[#0b0c0e] !bg-[#ff6a2b] !z-20 pointer-events-auto";

export function LeftRightHandles({ connectable = true }: { connectable?: boolean }) {
  return (
    <>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        isConnectable={connectable}
        className={handleClass}
        style={{ left: -8 }}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        isConnectable={connectable}
        className={handleClass}
        style={{ right: -8 }}
      />
    </>
  );
}
