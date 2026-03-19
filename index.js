const ENDPOINT = "http://127.0.0.1:18791/agent-push";

async function pushState(name, state, memo) {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        state,
        memo,
      }),
    });
  } catch (err) {
    console.error("[star-office] push failed:", err.message);
  }
}

function getName(event) {
  return event?.agent?.name || "agent";
}

/**
 * 状态识别（核心逻辑）
 */
function detectState(event) {
  // ❌ 出错优先
  if (event?.error) {
    return ["error", event.error?.message || "Error"];
  }

  // 🔧 工具调用
  if (event?.type === "tool_call" || event?.tool) {
    return ["executing", `Running ${event?.tool?.name || "tool"}`];
  }

  // 🔍 搜索 / 检索
  if (
    event?.type === "search" ||
    event?.type === "retrieval" ||
    event?.phase === "research"
  ) {
    return ["researching", "Researching..."];
  }

  // 🔄 数据处理
  if (event?.type === "sync" || event?.phase === "sync") {
    return ["syncing", "Syncing..."];
  }

  // ✍️ 默认写作
  return ["writing", "Working..."];
}

export default {
  lifecycle: {
    /**
     * 开始
     */
    async before_agent_start(event) {
      await pushState(getName(event), "writing", "Starting...");
    },

    /**
     * 中间过程（关键）
     */
    async on_event(event) {
      const [state, memo] = detectState(event);
      await pushState(getName(event), state, memo);
    },

    /**
     * 结束
     */
    async after_agent_end(event) {
      const name = getName(event);

      if (event?.success === false) {
        await pushState(name, "error", "Failed");
      } else {
        await pushState(name, "idle", "Idle");
      }
    },
  },
};
