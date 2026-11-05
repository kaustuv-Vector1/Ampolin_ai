FROM n8nio/n8n:latest

USER root

# Hugging Face Spaces exposes port 7860
ENV N8N_PORT=7860
ENV N8N_PROTOCOL=https
ENV NODE_ENV=production
ENV N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
ENV GENERIC_TIMEZONE=Asia/Kolkata

EXPOSE 7860

CMD ["n8n", "start"]
