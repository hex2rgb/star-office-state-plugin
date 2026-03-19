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
  // 状态映射
  function mapState(event) {
    switch (event.type) {
      case "task:start":
        return "executing";
      case "task:thinking":
        return "thinking";
      case "task:tool_call":
        return "executing";
      case "task:error":
        return "error";
      case "task:done":
        return "idle";
      default:
        return null;
    }
  }

  // 防抖（避免重复刷）
  const lastStateMap = new Map();

  // 发送状态
  async function pushState(agent, state, text) {
    try {
      const last = lastStateMap.get(agent);
      if (last === state) return;
      lastStateMap.set(agent, state);

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
      // 吞掉错误
    }
  }

  // Agent 启动 - 使用 before_agent_start hook
  api.on("before_agent_start", async function (event, ctx) {
    await pushState(ctx.agent?.id || "unknown", "idle", "agent started");
  });

  // Agent 停止 - 使用 agent_end hook
  api.on("agent_end", async function (event, ctx) {
    await pushState(ctx.agent?.id || "unknown", "idle", "agent stopped");
  });

  // LLM 输出监听 - 用来捕获执行and思考事件
  api.on("llm_output", async function (event, ctx) {
    console.log("star ui - llm_output", event);
    const state = "executing";
    
    await pushState(
      ctx.agent?.id || "unknown",
      state,
      event.response?.content?.text || ""
    );
  });

  // 消息发送 - 替代输出流
  api.on("message_sent", async function (event, ctx) {
    if (!event.message?.content) return;

    await pushState(
      ctx.agent?.id || "unknown",
      "executing",
      event.message.content
    );
  });
};
