// 固定目标地址（不允许外部配置）
const ENDPOINT = "http://localhost:19000";

/**
 curl -X POST http://localhost:19000/set_state \
 -H "Content-Type: application/json" \
 -d '{
 "agent": "demo",
 "state": "writing",
 "text": "hello world"
 }'

*/



export default function register(api) {
  // 防抖（避免重复刷）
  const lastStateMap = new Map();

  // 发送状态
  async function pushState(agent, state, text) {
    try {
      const last = lastStateMap.get(agent);
      if (last === state) return;
      lastStateMap.set(agent, state);

      api.logger?.info?.(`[star-office] pushState: agent=${agent}, state=${state}, text=${text?.substring(0, 50)}`);

      await fetch(ENDPOINT + "/set_state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agent: agent,
          state: state,
          text: text || ""
        })
      });
    } catch (e) {
      api.logger?.error?.(`[star-office] pushState error: ${e}`);
    }
  }

  // 根据工具名称判断状态
  function getStateFromToolName(toolName) {
    if (!toolName) return "executing";

    const lowerName = toolName.toLowerCase();

    // writing - 写代码/写文档
    if (lowerName.includes("write") || lowerName.includes("edit")) {
      return "writing";
    }

    // researching - 搜索/调研
    if (lowerName.includes("search") || lowerName.includes("grep") ||
        lowerName.includes("glob") || lowerName.includes("read") ||
        lowerName.includes("fetch") || lowerName.includes("explore")) {
      return "researching";
    }

    // syncing - 同步数据/推送
    if (lowerName.includes("git") || lowerName.includes("push") ||
        lowerName.includes("commit") || lowerName.includes("sync")) {
      return "syncing";
    }

    // 默认为 executing
    return "executing";
  }

  api.logger?.info?.("[star-office] Plugin registered");

  // Agent 启动
  api.on("before_agent_start", async function (event, ctx) {
    api.logger?.info?.("[star-office] Hook: before_agent_start");
    await pushState(ctx.agentId || "unknown", "idle", "");
  });

  // Agent 结束
  api.on("agent_end", async function (event, ctx) {
    api.logger?.info?.("[star-office] Hook: agent_end");
    if (event.error) {
      await pushState(ctx.agentId || "unknown", "error", event.error);
    } else {
      await pushState(ctx.agentId || "unknown", "idle", "");
    }
  });

  // LLM 输出 - 思考状态
  api.on("llm_output", async function (event, ctx) {
    api.logger?.info?.("[star-office] Hook: llm_output");
    const text = event.assistantTexts?.join("") || "";
    // 只有当有实际输出内容时才更新为writing状态
    if (text.trim()) {
      await pushState(ctx.agentId || "unknown", "writing", text);
    }
  });

  // 工具调用前 - 根据工具类型设置状态
  api.on("before_tool_call", async function (event, ctx) {
    api.logger?.info?.(`[star-office] Hook: before_tool_call, tool=${event.toolName}`);
    const state = getStateFromToolName(event.toolName);
    await pushState(ctx.agentId || "unknown", state, event.toolName);
  });

  // 工具调用后 - 如果有错误则设置error状态
  api.on("after_tool_call", async function (event, ctx) {
    api.logger?.info?.(`[star-office] Hook: after_tool_call, tool=${event.toolName}`);
    if (event.error) {
      await pushState(ctx.agentId || "unknown", "error", event.error);
    }
  });
};

