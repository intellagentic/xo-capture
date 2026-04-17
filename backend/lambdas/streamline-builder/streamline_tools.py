"""
Bedrock Converse tool definitions for Streamline Builder.
Claude decides step sequence and descriptions. Python code builds the config from templates.
"""

TOOLS = [
    {
        "toolSpec": {
            "name": "create_streamline_project",
            "description": """Create a Streamline project. Provide:
- project_name: string
- workflow_name: string
- steps: array of objects, each with:
  - description: string (step name)
  - type: one of: data_capture, new_logic_step, notification, document, webhook, outbound_webhook, collaboration, sign, extract_data_from_files, data_search, deliver_data, transform
  - form_fields: (ONLY for data_capture steps) array of {id, label, help_text} objects for the form fields
  - notification_to: (ONLY for notification steps) email address string
  - notification_subject: (ONLY for notification steps) subject line string
  - notification_body: (ONLY for notification steps) HTML body string

The Lambda will build the exact Streamline API config from proven templates. Do NOT generate raw config objects.""",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "project_name": {"type": "string"},
                        "workflow_name": {"type": "string"},
                        "steps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "description": {"type": "string"},
                                    "type": {"type": "string"},
                                    "form_fields": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "id": {"type": "string"},
                                                "label": {"type": "string"},
                                                "help_text": {"type": "string"}
                                            }
                                        }
                                    },
                                    "notification_to": {"type": "string"},
                                    "notification_subject": {"type": "string"},
                                    "notification_body": {"type": "string"}
                                },
                                "required": ["description", "type"]
                            }
                        }
                    },
                    "required": ["project_name", "workflow_name", "steps"]
                }
            }
        }
    }
]


def build_form_config(step_description, form_fields):
    """Build a proven-working data_capture config from field definitions."""
    components = [
        {
            "type": "static_content",
            "readonly": False,
            "components": [],
            "validation": {"required": False},
            "presentation": {
                "form": {
                    "type": "heading",
                    "label": "Header",
                    "level": 1,
                    "content": step_description,
                    "textAlign": "left"
                }
            }
        }
    ]

    for field in (form_fields or []):
        components.append({
            "id": field.get("id", field.get("label", "field").lower().replace(" ", "_")),
            "type": "text",
            "label": "",
            "parentId": "",
            "readonly": False,
            "components": [],
            "validation": {"required": False},
            "presentation": {
                "form": {
                    "type": "input",
                    "label": field.get("label", "Field"),
                    "helpText": field.get("help_text", field.get("label", ""))
                }
            }
        })

    return {
        "type": "data-capture",
        "readonly": False,
        "components": [
            {
                "type": "group",
                "readonly": False,
                "components": components
            }
        ],
        "presentation": {
            "form": {"label": "", "submitLabel": "Submit"}
        }
    }


def build_notification_config(to_email, subject, body):
    """Build a proven-working notification config."""
    return {
        "notifications": [
            {
                "label": "Notification 1",
                "smsConfig": None,
                "emailConfig": {
                    "from": "XO Capture",
                    "message": body or "<p>Notification from workflow</p>",
                    "replyTo": to_email or "",
                    "subject": subject or "Workflow Notification",
                    "recipients": [to_email] if to_email else [],
                    "attachments": []
                }
            }
        ]
    }


def build_logic_config(next_step_description=""):
    """Build a working new_logic_step config. Branch targets must reference the next step description."""
    target = next_step_description or ""
    return {
        "branches": [
            {"label": "Yes", "target": target, "condition": {"type": "group", "conditions": [], "logicOperator": "AND"}},
            {"label": "No", "target": target, "condition": {"type": "group", "conditions": [], "logicOperator": "AND"}},
        ]
    }


def build_outbound_webhook_config(url="", body_fields=None):
    """Build a working outbound_webhook config."""
    body_content = {}
    for f in (body_fields or []):
        body_content[f.get("key", "field")] = f.get("value", "")
    return {
        "request": {
            "url": url or "https://example.com/webhook",
            "body": {"content": body_content} if body_content else {},
            "method": "POST",
            "headers": {}
        }
    }


def build_incoming_webhook_config():
    """Build a working incoming_webhook config."""
    return {"authenticationType": "NONE"}


def build_document_config(name="Document"):
    """Build a minimal document config that the builder can render."""
    return {
        "name": name,
        "type": "DYNAMIC",
        "templates": []
    }


SUPPORTED_STEP_TYPES = {
    'data_capture', 'notification', 'new_logic_step', 'outbound_webhook', 'incoming_webhook',
    'document', 'google_drive', 'google_sheets', 'sign', 'collaboration',
    'transform', 'amazon_s3', 'dropbox', 'onedrive', 'sharepoint', 'slack',
    'sendgrid', 'smtp', 'sftp', 'twilio', 'microsoft_outlook', 'microsoft_teams',
    'google_calendar', 'excel_online', 'extract_data_from_files',
    'data_activation_v2', 'webhook',
}


def build_streamline_schema(tool_input):
    """Build the full Streamline API schema. Only creates steps with proven config templates.
    Unsupported step types are collected as manual_steps for the user to add in the builder."""
    project_name = tool_input.get("project_name", "New Project")
    workflow_name = tool_input.get("workflow_name", "Workflow")
    steps_input = tool_input.get("steps", [])

    steps = []
    manual_steps = []
    prev_description = None

    # Map legacy/alias type names to valid Streamline API types
    TYPE_ALIASES = {
        'incoming_webhook': 'webhook',
    }

    for step in steps_input:
        step_type = TYPE_ALIASES.get(step["type"], step["type"])

        if step_type not in SUPPORTED_STEP_TYPES:
            manual_steps.append(f"{step['description']} ({step_type})")
            continue

        step_obj = {
            "description": step["description"],
            "type": step_type,
            "edges": [] if prev_description is None else [{"prev": prev_description}]
        }

        if step_type == "data_capture" and step.get("form_fields"):
            step_obj["config"] = build_form_config(step["description"], step["form_fields"])
        elif step_type == "notification":
            step_obj["config"] = build_notification_config(
                step.get("notification_to", ""),
                step.get("notification_subject", ""),
                step.get("notification_body", "")
            )
        elif step_type == "new_logic_step":
            # Find next supported step's description for branch targets
            next_desc = ""
            for future in steps_input[steps_input.index(step) + 1:]:
                if future["type"] in SUPPORTED_STEP_TYPES:
                    next_desc = future["description"]
                    break
            step_obj["config"] = build_logic_config(next_desc)
        elif step_type == "outbound_webhook":
            step_obj["config"] = build_outbound_webhook_config(
                step.get("webhook_url", ""),
                step.get("webhook_body_fields")
            )
        elif step_type == "webhook":
            step_obj["config"] = build_incoming_webhook_config()
        elif step_type == "document":
            step_obj["config"] = build_document_config(step.get("description", "Document"))

        steps.append(step_obj)
        prev_description = step["description"]

    # Add manual steps info to project description
    description = ""
    if manual_steps:
        description = "Add these steps in the builder: " + " → ".join(manual_steps)

    return {
        "name": project_name,
        "description": description or None,
        "workflow": {
            "accessType": "public",
            "name": workflow_name,
            "steps": steps
        },
        "_manual_steps": manual_steps
    }


SYSTEM_PROMPT = """You are a Streamline workflow builder. Given an application description, decide the step sequence and call create_streamline_project.

## Step Types

WITH CONFIG (Lambda builds config from templates):
| Type | API value | What to provide |
|------|-----------|-----------------|
| Forms | data_capture | form_fields array |
| Notification | notification | notification_to, notification_subject, notification_body |
| Logic | new_logic_step | nothing extra — branches auto-generated |
| Incoming Webhook | incoming_webhook | nothing extra |
| Outbound Webhook | outbound_webhook | optional: webhook_url |

NO CONFIG NEEDED (created as steps, configured in builder):
| Type | API value |
|------|-----------|
| Document | document |
| Google Drive | google_drive |
| Google Sheets | google_sheets |
| Sign | sign |
| Collaboration | collaboration |
| Transform | transform |
| Amazon S3 | amazon_s3 |
| Slack | slack |
| Extract Data | extract_data_from_files |

IMPORTANT: Logic type is "new_logic_step" NOT "logic".
IMPORTANT: Google Drive type is "google_drive" NOT "gdrive" or "drive".

## For data_capture steps

Provide form_fields — an array of simple field definitions:
[
  {"id": "field_id", "label": "Display Label", "help_text": "Helper text"},
  ...
]
Keep to 3-6 fields. All fields render as text inputs. The Lambda builds the full config.

## For notification steps

Provide:
- notification_to: recipient email (or leave empty for builder config)
- notification_subject: email subject line
- notification_body: HTML body (use <p> tags)

IMPORTANT: Do NOT use field mappings like {{`Step`.`field`}} in notification fields.
Use plain text only. Field mapping is configured in the Streamline builder.

## For all other step types

Just provide description and type. Users configure them in the Streamline builder.

## Your Task

1. Map each workflow step to the correct Streamline step type
2. For forms: define 3-6 relevant fields
3. For notifications: define recipient/subject/body
4. Call create_streamline_project with project_name, workflow_name, and steps
5. Report which steps need manual builder configuration

Project name: "{Client Name} - {Application Title}"
Step descriptions: specific to the client's use case.
"""
