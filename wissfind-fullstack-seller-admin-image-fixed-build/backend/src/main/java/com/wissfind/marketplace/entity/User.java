package com.wissfind.marketplace.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name="users", uniqueConstraints={@UniqueConstraint(columnNames="phone")})
public class User extends BaseEntity {
    @Column(nullable=false) public String name;
    @Column(nullable=false) public String phone;
    public String email;
    @Column(nullable=false) @JsonIgnore public String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable=false) public Role role=Role.CUSTOMER;
    public boolean phoneVerified=false;
    public boolean enabled=true;

    /** Telegram private chat id used for seller order notifications. */
    @Column(name="telegram_chat_id")
    public String telegramChatId;

    /** One-time token used to safely bind a seller account to a Telegram chat. */
    @Column(name="telegram_connect_token", unique=true, length=64)
    @JsonIgnore
    public String telegramConnectToken;

    public enum Role { CUSTOMER, SELLER, ADMIN }
}
