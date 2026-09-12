package com.wissfind.marketplace.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "homepage_configuration")
public class HomepageConfiguration {
    @Id
    public Long id = 1L;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public Mode mode = Mode.AUTOMATIC;

    @Column(length = 2000)
    public String manualProductIds = "";

    public double ordersWeight = 0.50;
    public double ratingsWeight = 0.30;
    public double viewsWeight = 0.20;

    public enum Mode { AUTOMATIC, MANUAL, HYBRID }
}
