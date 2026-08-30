package com.wissfind.marketplace.controller;

import com.wissfind.marketplace.entity.Category;
import com.wissfind.marketplace.repo.CategoryRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    private final CategoryRepository repo;
    public CategoryController(CategoryRepository r){repo=r;}

    public record Dto(Long id,String name,String slug,String parentName,Long parentId,List<Dto> subcategories,boolean active){}
    public record Flat(Long id,String name,String slug,Long parentId,String parentName,boolean active){}

    @GetMapping public List<Flat> all(){return repo.findAll().stream().map(c->new Flat(c.id,c.name,c.slug,c.parent==null?null:c.parent.id,c.parent==null?null:c.parent.name,c.active)).toList();}

    @GetMapping("/tree")
    public List<Dto> tree(){
        return repo.findByParentIsNullAndActiveTrueOrderByName().stream().map(this::map).toList();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Category create(@RequestBody Map<String,Object> body){
        String name=string(body.get("name")); String slug=string(body.get("slug"));
        if(name.isBlank()||slug.isBlank()) throw new IllegalArgumentException("Category name and slug are required");
        if(repo.existsBySlugIgnoreCase(slug)) throw new IllegalArgumentException("Category slug already exists");
        Category c=new Category(); c.name=name.trim(); c.slug=slug.trim().toLowerCase(); c.active=true;
        Long parentId=longValue(body.get("parentId"));
        if(parentId!=null)c.parent=repo.findById(parentId).orElseThrow();
        return repo.save(c);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Category update(@PathVariable Long id,@RequestBody Map<String,Object> body){
        Category c=repo.findById(id).orElseThrow();
        String name=string(body.get("name")); String slug=string(body.get("slug"));
        if(name.isBlank()||slug.isBlank()) throw new IllegalArgumentException("Category name and slug are required");
        if(repo.existsBySlugIgnoreCaseAndIdNot(slug,id)) throw new IllegalArgumentException("Category slug already exists");
        c.name=name.trim(); c.slug=slug.trim().toLowerCase();
        if(body.containsKey("active"))c.active=Boolean.TRUE.equals(body.get("active"));
        Long parentId=longValue(body.get("parentId"));
        if(parentId!=null){ if(parentId.equals(id)) throw new IllegalArgumentException("A category cannot be its own parent"); c.parent=repo.findById(parentId).orElseThrow(); }
        else c.parent=null;
        return repo.save(c);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id){
        Category c=repo.findById(id).orElseThrow();
        if(repo.existsByParentId(id)) throw new IllegalArgumentException("Delete or move subcategories first");
        c.active=false;
        repo.save(c);
    }

    private Dto map(Category c){return new Dto(c.id,c.name,c.slug,c.parent==null?null:c.parent.name,c.parent==null?null:c.parent.id,repo.findByParentIdAndActiveTrueOrderByName(c.id).stream().map(this::map).toList(),c.active);}
    private static String string(Object o){return o==null?"":String.valueOf(o);}
    private static Long longValue(Object o){return o==null?null:Long.valueOf(String.valueOf(o));}
}
