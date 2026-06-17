package com.videocall.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@Service
public class EmailService {
    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String mailHost;
    private final String mailUsername;
    private final String sendGridApiKey;
    private final String sendGridFromEmail;
    private final String sendGridFromName;
    private final String sendGridApiUrl;
    private final String resendApiKey;
    private final String resendFromEmail;
    private final String resendApiUrl;
    private final RestTemplate restTemplate = new RestTemplate();

    public EmailService(
            JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${app.email.sendgrid-api-key:}") String sendGridApiKey,
            @Value("${app.email.sendgrid-from-email:}") String sendGridFromEmail,
            @Value("${app.email.sendgrid-from-name:RURO}") String sendGridFromName,
            @Value("${app.email.sendgrid-api-url:https://api.sendgrid.com/v3/mail/send}") String sendGridApiUrl,
            @Value("${app.email.resend-api-key:}") String resendApiKey,
            @Value("${app.email.resend-from-email:}") String resendFromEmail,
            @Value("${app.email.resend-api-url:https://api.resend.com/emails}") String resendApiUrl
    ) {
        this.mailSender = mailSender;
        this.mailHost = mailHost;
        this.mailUsername = mailUsername;
        this.sendGridApiKey = sendGridApiKey;
        this.sendGridFromEmail = sendGridFromEmail;
        this.sendGridFromName = sendGridFromName;
        this.sendGridApiUrl = sendGridApiUrl;
        this.resendApiKey = resendApiKey;
        this.resendFromEmail = resendFromEmail;
        this.resendApiUrl = resendApiUrl;
    }

    /**
     * Send OTP using SendGrid, Resend, or another configured third-party API when available,
     * otherwise fall back to SMTP.
     * Returns true if the OTP was successfully handed off to a sender.
     */
    public boolean sendOtp(String email, String otp, String subject) {
        String body = "Your RURO verification OTP is: " + otp + "\n\nThis code expires soon.";
        String html = buildOtpEmailHtml(otp);

        if (StringUtils.hasText(sendGridApiKey) && StringUtils.hasText(sendGridFromEmail)) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(sendGridApiKey);

                Map<String, Object> payload = Map.of(
                        "personalizations", List.of(Map.of(
                                "to", List.of(Map.of("email", email)),
                                "subject", subject
                        )),
                        "from", Map.of(
                                "email", sendGridFromEmail,
                                "name", StringUtils.hasText(sendGridFromName) ? sendGridFromName : "RURO"
                        ),
                        "content", List.of(
                                Map.of("type", "text/plain", "value", body),
                                Map.of("type", "text/html", "value", html)
                        )
                );

                ResponseEntity<String> resp = restTemplate.postForEntity(
                        sendGridApiUrl,
                        new HttpEntity<>(payload, headers),
                        String.class
                );

                if (resp.getStatusCode().is2xxSuccessful()) {
                    return true;
                }

                logger.warn("SendGrid OTP delivery returned status {}", resp.getStatusCode());
            } catch (HttpStatusCodeException ex) {
                logger.warn(
                        "SendGrid OTP delivery failed with status {}: {}",
                        ex.getStatusCode(),
                        ex.getResponseBodyAsString()
                );
            } catch (Exception ex) {
                logger.warn("SendGrid OTP delivery failed: {}", ex.getMessage());
            }
        }

        if (StringUtils.hasText(resendApiKey) && StringUtils.hasText(resendFromEmail)) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(resendApiKey);
                headers.set("User-Agent", "ruro-video-call/1.0");

                Map<String, Object> payload = Map.of(
                        "from", resendFromEmail,
                        "to", List.of(email),
                        "subject", subject,
                        "html", html,
                        "text", body
                );

                ResponseEntity<String> resp = restTemplate.postForEntity(
                        resendApiUrl,
                        new HttpEntity<>(payload, headers),
                        String.class
                );

                if (resp.getStatusCode().is2xxSuccessful()) {
                    return true;
                }

                logger.warn("Resend OTP delivery returned status {}", resp.getStatusCode());
            } catch (HttpStatusCodeException ex) {
                logger.warn(
                        "Resend OTP delivery failed with status {}: {}",
                        ex.getStatusCode(),
                        ex.getResponseBodyAsString()
                );
            } catch (Exception ex) {
                logger.warn("Resend OTP delivery failed: {}", ex.getMessage());
            }
        }

        // Fallback to SMTP if configured
        if (!StringUtils.hasText(mailHost) || !StringUtils.hasText(mailUsername)) {
            return false;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            return true;
        } catch (Exception ex) {
            logger.warn("SMTP OTP delivery failed: {}", ex.getMessage());
            return false;
        }
    }

    public void sendWelcomeEmail(String email, String fullName) {
        String subject = "Welcome to RURO";
        String safeName = StringUtils.hasText(fullName) ? fullName : "there";
        String body = "Hi " + safeName + ",\n\nYour RURO account is ready. You can now create and join secure video rooms.";
        String html = """
                <div style="font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e5e7eb;padding:32px;border-radius:12px">
                  <h1 style="margin:0 0 12px;color:#ffffff;font-size:24px">Welcome to RURO</h1>
                  <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6">Hi %s, your account is ready. You can now create and join secure video rooms.</p>
                </div>
                """.formatted(safeName);
        sendTransactionalEmail(email, subject, body, html);
    }

    private boolean sendTransactionalEmail(String email, String subject, String body, String html) {
        if (StringUtils.hasText(sendGridApiKey) && StringUtils.hasText(sendGridFromEmail)) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(sendGridApiKey);
                Map<String, Object> payload = Map.of(
                        "personalizations", List.of(Map.of("to", List.of(Map.of("email", email)), "subject", subject)),
                        "from", Map.of("email", sendGridFromEmail, "name", StringUtils.hasText(sendGridFromName) ? sendGridFromName : "RURO"),
                        "content", List.of(Map.of("type", "text/plain", "value", body), Map.of("type", "text/html", "value", html))
                );
                return restTemplate.postForEntity(sendGridApiUrl, new HttpEntity<>(payload, headers), String.class)
                        .getStatusCode()
                        .is2xxSuccessful();
            } catch (Exception ex) {
                logger.warn("SendGrid transactional email failed: {}", ex.getMessage());
            }
        }

        if (StringUtils.hasText(resendApiKey) && StringUtils.hasText(resendFromEmail)) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(resendApiKey);
                Map<String, Object> payload = Map.of("from", resendFromEmail, "to", List.of(email), "subject", subject, "html", html, "text", body);
                return restTemplate.postForEntity(resendApiUrl, new HttpEntity<>(payload, headers), String.class)
                        .getStatusCode()
                        .is2xxSuccessful();
            } catch (Exception ex) {
                logger.warn("Resend transactional email failed: {}", ex.getMessage());
            }
        }

        if (!StringUtils.hasText(mailHost) || !StringUtils.hasText(mailUsername)) {
            return false;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            return true;
        } catch (Exception ex) {
            logger.warn("SMTP transactional email failed: {}", ex.getMessage());
            return false;
        }
    }

    private String buildOtpEmailHtml(String otp) {
        return """
                <div style="font-family:Inter,Arial,sans-serif;background:#0a0a0c;color:#e4e4e7;padding:32px;border-radius:16px">
                  <p style="margin:0 0 12px;color:#a1a1aa;font-size:13px;letter-spacing:2px;text-transform:uppercase">RURO Verification</p>
                  <h1 style="margin:0 0 16px;color:#ffffff;font-size:24px">Your secure OTP</h1>
                  <p style="margin:0 0 24px;color:#d4d4d8;font-size:15px;line-height:1.6">Use this code to complete your RURO verification. Do not share it with anyone.</p>
                  <div style="display:inline-block;background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:16px 22px;color:#ffffff;font-size:30px;font-weight:700;letter-spacing:8px">%s</div>
                  <p style="margin:24px 0 0;color:#71717a;font-size:13px">This code expires soon. If you did not request it, ignore this email.</p>
                </div>
                """.formatted(otp);
    }
}
