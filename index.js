// 固定目标地址（不允许外部配置）
const ENDPOINT = "http://localhost:19000";

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

  // Agent 启动
  api.onAgentStart(async function (agent) {
    await pushState(agent.id, "idle", "agent started");
  });

  // Agent 停止
  api.onAgentStop(async function (agent) {
    await pushState(agent.id, "idle", "agent stopped");
  });

  // 核心事件监听
  api.onAgentEvent(async function (event, ctx) {
    const state = mapState(event);
    if (!state) return;

    await pushState(
      ctx.agent.id,
      state,
      event.summary || ""
    );
  });

  // 输出流（可选）
  api.onAgentOutput(async function (chunk, ctx) {
    if (!chunk || !chunk.text) return;

    await pushState(
      ctx.agent.id,
      "executing",
      chunk.text
    );
  });
};
