package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.User;
import com.wissfind.marketplace.repo.UserRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final UserRepository users;
    public AdminController(UserRepository users){this.users=users;}

    @GetMapping("/users")
    public List<User> users(@RequestParam(required=false) User.Role role){
        if(role==null)return users.findAll();
        return users.findAll().stream().filter(u->u.role==role).toList();
    }

    @PatchMapping("/users/{id}/enabled")
    public User enabled(@PathVariable Long id,@RequestParam boolean value){
        User u=users.findById(id).orElseThrow();
        u.enabled=value;
        return users.save(u);
    }
}
