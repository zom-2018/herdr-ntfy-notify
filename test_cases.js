import { execSync } from 'child_process';

const testCases = [
  {
    name: "Case 1: Agent Done (Standard)",
    env: {
      HERDR_SESSION: "dev-session",
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "pane.agent_status_changed",
        data: {
          type: "pane_agent_status_changed",
          pane_id: "p1",
          workspace_id: "my-project",
          agent_status: "done",
          agent: "Codex",
          title: "Refactor login controller"
        }
      }),
      HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
        focused_pane_workspace: "my-project",
        focused_pane_tab: "editor",
        focused_pane_id: "p1"
      })
    }
  },
  {
    name: "Case 2: Agent Blocked (Question / Prompt)",
    env: {
      HERDR_SESSION: "infra-deploy",
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "pane.agent_status_changed",
        data: {
          type: "pane_agent_status_changed",
          pane_id: "p2",
          workspace_id: "deployment-infra",
          agent_status: "blocked",
          agent: "Hermes",
          custom_status: "Invalid credentials for AWS. Please provide valid AWS_ACCESS_KEY_ID."
        }
      }),
      HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
        focused_pane_workspace: "deployment-infra",
        focused_pane_tab: "TUI",
        focused_pane_id: "p2"
      })
    }
  },
  {
    name: "Case 3: Agent Blocked (Error match)",
    env: {
      HERDR_SESSION: "web-testing",
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "pane.agent_status_changed",
        data: {
          type: "pane_agent_status_changed",
          pane_id: "p3",
          workspace_id: "web-app",
          agent_status: "blocked",
          agent: "OMP",
          state_labels: {
            error: "ReferenceError: x is not defined at index.js:10:15"
          }
        }
      }),
      HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
        focused_pane_workspace: "web-app",
        focused_pane_tab: "tests",
        focused_pane_id: "p3"
      })
    }
  },
  {
    name: "Case 4: Long Status Truncation",
    env: {
      HERDR_SESSION: "heavy-work",
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "pane.agent_status_changed",
        data: {
          type: "pane_agent_status_changed",
          pane_id: "p4",
          workspace_id: "docs-search",
          agent_status: "blocked",
          agent: "Librarian",
          custom_status: "This is a very long error message that will definitely exceed the standard length boundary and trigger the truncation logic implemented in the notify.mjs script to verify it outputs exactly three dots at the end."
        }
      }),
      HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
        focused_pane_workspace: "docs-search",
        focused_pane_tab: "docs",
        focused_pane_id: "p4"
      })
    }
  }
];

console.log("Running deterministic ntfy test cases...");
for (const tc of testCases) {
  console.log(`\n--> Running: ${tc.name}`);
  try {
    execSync("node notify.mjs", {
      env: { ...process.env, ...tc.env },
      stdio: 'inherit'
    });
    console.log("    Completed successfully.");
  } catch (err) {
    console.error(`    Failed: ${err.message}`);
  }
}
console.log("\nAll test cases executed.");
