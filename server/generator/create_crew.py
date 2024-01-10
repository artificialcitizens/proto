import json
from crewai import Task, Crew, Process
from langchain_community.chat_models import ChatOpenAI
from models.chat_models import model_mapping
from agents.custom_agent import ExtendedAgent
def create_crew_from_config(config_string, tool_mapping, socketio):
    config = json.loads(config_string)
    # Create the ChatOpenAI objects
    llms = {}
    for agent_config in config["agents"]:
        llm = agent_config.pop("llm")
        llm_config = model_mapping[llm]
        llm_key = f"{llm_config['base_url']}_{llm_config['model_name']}"
        if llm_key not in llms:
            llms[llm_key] = ChatOpenAI(**llm_config)
        agent_config["llm"] = llms[llm_key]

        # Remove id from agent_config
        agent_config.pop("id", None)

        # Create the tools
        if "tools" in agent_config:
            agent_config["tools"] = [tool_mapping[tool_name] for tool_name in agent_config["tools"]]

    # Create the Agent objects
    agents = {
        agent_config["role"]: ExtendedAgent(**agent_config, socketio=socketio)
        for agent_config in config["agents"]
    }

    # Create the Task objects
    tasks = []
    for task_config in config["tasks"]:
        task_config = task_config.copy()
        agent_role = task_config.pop("agent")
        if agent_role not in agents:
            raise Exception(f"No agent found with role '{agent_role}'")
        
        # Remove id from task_config
        task_config.pop("id", None)

        if "tools" in task_config:
            task_config["tools"] = [tool_mapping[tool_name] for tool_name in task_config["tools"]]
        tasks.append(Task(agent=agents[agent_role], **task_config))

    # Create the Crew object
    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        process=Process[config["process"]]
    )

    return crew